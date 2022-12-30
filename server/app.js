////////// dependencies ///////////
require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

const serve = require("./modules/staticServe")(app);
const pool = require("./modules/DB-connection");
const SHA256 = require("./modules/SHA256");
const auth = require("./modules/auth");
const Sessions = require("./modules/sessions");
Sessions.ageSessions(10000);

app.use(express.json(), cookieParser(), auth(["/private-api"]));

/////////// static routing ///////////

serve("build", path.join(__dirname, "../client/build"));
serve("account", path.join(__dirname, "../account"));

app.get("/SHA256.js", (req, res) => {
    res.sendFile(path.join(__dirname, "./modules/SHA256.js"));
});

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "../client/build/index.html"))
);

app.get("/login", (req, res) =>
    res.sendFile(path.join(__dirname, "../account/login/login.html"))
);

app.get("/signUp", (req, res) =>
    res.sendFile(path.join(__dirname, "../account/signUp/signUp.html"))
);
/////////// methods //////////////

//account related

app.post("/api/createAccount", async (req, res) => {
    const { email, hash, salt } = req.body;
    pool.query(
        `SELECT id FROM login WHERE email="${email}"`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            if (response[0])
                return res.status(409).send({ error: "email already in use" });

            pool.query(
                `INSERT INTO login (email, salt, digest) VALUES ("${email}","${salt}","${hash}")`,
                (err, response) => {
                    if (err)
                        return (
                            console.error(err),
                            res
                                .status(500)
                                .send({ error: "internal server error" })
                        );
                    res.status(201).send({ ok: "account successfuly created" });
                }
            );
        }
    );
});

app.delete("/private-api/deleteAccount", (req, res) => {
    const { session_id } = req.cookies;
    const user_id = Sessions.getUserId(session_id);
    pool.query(`DELETE FROM login WHERE id=${user_id}`, (err, res) => {
        if (err)
            return (
                console.error(err),
                res.status(500).send({ error: "internal server error" })
            );
        res.status(200).send({ ok: "account successfuly deleted" });
    });
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    pool.query(
        `SELECT salt, digest, id FROM login WHERE email='${email}'`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "Internal server error" })
                );

            if (!response[0])
                return res.status(401).send({ error: "email not recognized" });

            const { salt, digest, id } = response[0];
            if (!(SHA256(password + salt) === digest))
                return res.status(401).send({ error: "wrong password" });

            const session_id = Sessions.createSession(id);

            const ONE_DAY_ms = 3600 * 1000 * 24;

            res.cookie("session_id", session_id, {
                maxAge: ONE_DAY_ms,
                sameSite: true,
            });

            res.status(201).send({ ok: "session created" });
        }
    );
});

app.get("/private-api/logout", (req, res) => {
    const { session_id } = req.cookies;
    Sessions.killSession(session_id, "user logged out");
    res.clearCookie("session_id");
    res.status(205).send({ ok: "session terminated" });
});

app.get("/api/isClientLoggedIn", (req, res) => {
    const { session_id } = req.cookies;
    if (!session_id) return res.status(200).send(false);
    const isLoggedIn = Sessions.isLoggedIn(session_id);
    res.status(200).send(isLoggedIn);
});

//store related

app.get("/api/getItems", (req, res) => {
    pool.query(`SELECT * FROM items`, (err, response) => {
        if (err)
            return (
                console.error(err),
                res.status(500).send({ error: "internal server error" })
            );
        if (!response[0])
            return res.status(404).send({ error: "no item found" });
        res.status(200).send({ items: response });
    });
});

app.post("/api/getItemsByCategory", (req, res) => {
    let { category } = req.body;
    if (!category) category = req.cookies.category;
    if (!category || category === "all")
        return res.redirect(302, "/api/getItems");
    pool.query(
        `SELECT * FROM items WHERE category="${category}"`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            if (!response[0])
                return res.status(404).send({ error: "no item found" });
            res.status(200).send({ items: response });
        }
    );
});

app.post("/api/getItemsBySearchValue", (req, res) => {
    const { input, category } = req.body;
    if (category != "all" && category)
        pool.query(
            `SELECT * FROM items WHERE category="${category}"`,
            (err, response) => {
                if (err)
                    return (
                        console.error(err),
                        res.status(500).send({ error: "Internal server error" })
                    );
                if (!response[0])
                    return res
                        .status(404)
                        .send({ error: "no items where found" });
                const items = response;
                if (!input)
                    return res.status(200).send({ matchingItems: items });
                const matchingItems = findEveryMatch(items, (item) => {
                    if (
                        item.itemName
                            .toLowerCase()
                            .includes(input.toLowerCase())
                    )
                        return item;
                    return false;
                });
                res.status(200).send({ matchingItems });
            }
        );
    else
        pool.query(`SELECT * FROM items`, (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "Internal server error" })
                );
            if (!response[0])
                return res.status(404).send({ error: "no items where found" });
            const items = response;
            if (!input) return res.status(200).send({ matchingItems: items });
            const matchingItems = findEveryMatch(items, (item) => {
                if (item.itemName.toLowerCase().includes(input.toLowerCase()))
                    return item;
                return false;
            });
            res.status(200).send({ matchingItems });
        });
});

//if callback returns truthy value, for instance an element,
//this value (element) is pushed to the matches array that is later returned
function findEveryMatch(array, callback) {
    let matches = [];
    array.forEach((element) => {
        if (callback(element)) matches.push(callback(element));
    });
    return matches;
}

app.post("/api/setItemCookie", (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(422).send({ error: "no id specified" });
    res.cookie("item_id", id, {
        sameSite: true,
    });
    res.status(200).send({ ok: "item_id cookie was set" });
});

app.get("/api/getItem", (req, res) => {
    let { item_id } = req.cookies;
    if (!item_id)
        return res.status(404).send({ error: "item_id cookie not found" });
    pool.query(`SELECT * FROM items WHERE id=${item_id}`, (err, response) => {
        if (err)
            return (
                console.error(err),
                res.status(500).send({ error: "internal server error" })
            );
        if (!response[0])
            return res.status(404).send({ error: "item not found" });
        res.status(200).send({
            item: response[0],
            ok: "item data successfuly fetched",
        });
    });
});

app.post("/api/getItemThroughBody", (req, res) => {
    const { item_id } = req.body;
    if (!item_id)
        return res
            .status(422)
            .send({ error: "no item_id passed through request body" });
    pool.query(`SELECT * FROM items WHERE id=${item_id}`, (err, response) => {
        if (err)
            return (
                console.error(err),
                res.status(500).send({ error: "internal server error" })
            );
        if (!response[0])
            return res
                .status(404)
                .send({ error: `item with id ${item_id} not found in DB` });
        const item = response[0];
        res.status(200).send({ item });
    });
});

app.post("/api/addItemToCart", (req, res) => {
    const { quantity } = req.body;
    if (!quantity)
        return res.status(422).send({ error: "quantity not specified" });
    const { item_id, session_id } = req.cookies;
    if (!item_id)
        return res.status(422).send({ error: "missing item_id cookie" });

    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(307, "/api/addItemToCookieCart");

    const user_id = Sessions.getUserId(session_id);
    //TODO: check if item_id links to a real item
    pool.query(
        `INSERT INTO cart (userId, itemId, quantity) VALUES (${user_id}, ${item_id}, ${quantity})`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            res.status(200).send({ ok: "item added to DB cart" });
        }
    );
});

app.post("/api/addItemToCookieCart", (req, res) => {
    const { quantity } = req.body;
    const { item_id, cookieCart } = req.cookies;
    if (!cookieCart)
        return (
            res.cookie("cookieCart", `${item_id}<${quantity}`, {
                sameSite: true,
            }),
            res.status(201).send({ ok: "cookie cart created" })
        );

    res.cookie("cookieCart", `${cookieCart},${item_id}<${quantity}`, {
        sameSite: true,
    });
    res.status(200).send({ ok: "item added to cookieCart" });
});

app.get("/api/getCart", (req, res) => {
    const { session_id } = req.cookies;
    //if client not logged in, search for cookie cart
    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(302, "/api/getCookieCart");

    const user_id = Sessions.getUserId(session_id);

    pool.query(
        `SELECT * FROM cart WHERE userId=${user_id}`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            if (!response[0]) return res.status(200).send({ cart: [] });

            const cart = response.map((item) => {
                item.item_id = item.itemId;
                return item;
            });
            res.status(200).send({ cart });
        }
    );
});

app.get("/api/getCookieCart", (req, res) => {
    const { cookieCart } = req.cookies;
    if (!cookieCart) return res.status(200).send({ cart: [] });

    const cart = cartStringToArray(cookieCart);
    if (!cart) return res.status(200).send({ cart: [] });

    res.status(200).send({ cart });
});

app.get("/api/isItemInCart", (req, res) => {
    const { session_id, item_id } = req.cookies;
    if (!item_id)
        return res.status(422).send({ error: "missing item_id cookie" });
    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(302, "/api/isItemInCookieCart");

    const user_id = Sessions.getUserId(session_id);

    pool.query(
        `SELECT itemId FROM cart WHERE itemId=${item_id} AND userId=${user_id}`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            if (!response[0]) return res.status(200).send(false);
            res.status(200).send(true);
        }
    );
});

app.get("/api/isItemInCookieCart", (req, res) => {
    const { cookieCart, item_id } = req.cookies;
    if (!cookieCart) return res.status(200).send(false);
    if (cookieCart.includes(`${item_id}<`)) return res.status(200).send(true);
    res.status(200).send(false);
});

app.delete("/api/removeItemFromCart", (req, res) => {
    let { item_id } = req.body;
    let { session_id } = req.cookies;
    console.log("item id:", item_id);
    item_id ||= req.cookies.item_id;
    if (!item_id)
        return res.status(422).send({ error: "missing item_id cookie" });
    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(307, "/api/removeItemFromCookieCart");

    const user_id = Sessions.getUserId(session_id);

    pool.query(
        `DELETE FROM cart WHERE itemId=${item_id} AND userId=${user_id}`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "internal server error" })
                );
            res.status(200).send({
                ok: "item successfuly removed from db cart",
            });
        }
    );
});

app.delete("/api/removeItemFromCookieCart", (req, res) => {
    let { cookieCart } = req.cookies;
    let item_id = req.body.item_id || req.cookies.item_id;
    if (!item_id)
        return res
            .status(404)
            .send({ error: "no item_id found in cookies or request body" });
    if (!cookieCart)
        return res
            .status(404)
            .send({ error: "no cookie cart found in cookies" });

    const itemIdIndex = cookieCart.indexOf(item_id + "<");
    let nextComaIndex = cookieCart.indexOf(",", itemIdIndex);
    if (nextComaIndex === -1) nextComaIndex = cookieCart.length;

    let fullItemPart;
    if (itemIdIndex == 0)
        fullItemPart = cookieCart.substring(itemIdIndex, nextComaIndex + 1);
    else fullItemPart = cookieCart.substring(itemIdIndex - 1, nextComaIndex);

    const updatedCookieCart = cookieCart.replace(fullItemPart, "");

    res.cookie("cookieCart", updatedCookieCart, {
        sameSite: true,
    });
    res.status(200).send({ ok: "item removed from cookie cart" });
});

app.get("/api/getItemQuantity", (req, res) => {
    const { session_id, item_id } = req.cookies;
    if (!item_id)
        return res.status(422).send({ error: "Missing item_id cookie" });
    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(302, "/api/getItemQuantityFromCookieCart");

    const user_id = Sessions.getUserId(session_id);
    pool.query(
        `SELECT quantity FROM cart WHERE userId=${user_id} AND itemId=${item_id}`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "Internal server error." })
                );
            if (!response[0])
                return res.status(404).send({
                    error: `Quantity not found for item with id: ${item_id}.`,
                });

            const { quantity } = response[0];

            res.status(200).send({ quantity });
        }
    );
});

app.get("/api/getItemQuantityFromCookieCart", (req, res) => {
    const { cookieCart, item_id } = req.cookies;
    if (!cookieCart)
        return res.status(422).send({ error: "Missing cookieCart cookie" });
    const cart = cartStringToArray(cookieCart);
    const item = cart.find((item) => item.item_id === item_id);
    if (!item)
        return res.status(404).send({ error: "Item not found in cookieCart" });
    res.status(200).send({ quantity: item.quantity });
});

//payment related

app.post("/api/buyItem", (req, res) => {
    const { item_id, session_id } = req.cookies;
    const { quantity } = req.body;

    if (!item_id)
        return res.status(422).send({ error: "Missing item_id cookie" });

    pool.query(
        `SELECT * FROM items WHERE id=${item_id}`,
        async (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "Internal server error" })
                );
            if (!response[0])
                return res.status(404).send({ error: "Item not found" });

            const item = response[0];

            //converts it to stripe format
            const stripeItem = {
                price_data: {
                    unit_amount: item.priceInCents,
                    currency: "usd",
                    product_data: {
                        name: item.itemName,
                        images: [item.img],
                        description: item.description,
                    },
                },
                quantity: quantity,
            };

            //if user logged in
            if (session_id && Sessions.isLoggedIn(session_id)) {
                const user_id = Sessions.getUserId(session_id);

                pool.query(
                    `SELECT email FROM login WHERE id=${user_id}`,
                    async (err, response) => {
                        if (err)
                            return (
                                console.error(err),
                                res
                                    .status(500)
                                    .send({ error: "Interval server error" })
                            );
                        const { email } = response[0];

                        try {
                            const stripeSession =
                                await Stripe.checkout.sessions.create({
                                    cancel_url: websiteUrl + "/item/" + item_id,
                                    success_url:
                                        websiteUrl + "/item/" + item_id,
                                    mode: "payment",
                                    customer_email: email,
                                    line_items: [stripeItem],
                                });
                            res.json({ url: stripeSession.url }).status(200);
                        } catch (e) {
                            console.error(e);
                            res.status(500).send({ error: e });
                        }
                    }
                );
            }

            //if user as guest
            else {
                try {
                    const stripeSession = await Stripe.checkout.sessions.create(
                        {
                            cancel_url: websiteUrl + "/item/" + item_id,
                            success_url: websiteUrl + "/item/" + item_id,
                            mode: "payment",
                            line_items: [stripeItem],
                        }
                    );
                    return res.status(200).send({ url: stripeSession.url });
                } catch (e) {
                    console.error(e);
                    res.status(500).send({ error: e });
                }
            }
        }
    );
});

app.get("/api/buyCart", (req, res) => {
    const { session_id } = req.cookies;
    if (!session_id || !Sessions.isLoggedIn(session_id))
        return res.redirect(302, "/api/buyCookieCart");

    const user_id = Sessions.getUserId(session_id);

    pool.query(
        `SELECT * FROM cart WHERE userId=${user_id}`,
        (err, response) => {
            if (err)
                return (
                    console.error(err),
                    res.status(500).send({ error: "Internal server error" })
                );
            if (!response[0])
                return res.status(404).send({ error: "No DB cart found" });

            const cart = response;
            const stripeItems = [];

            for (const item of cart) {
                pool.query(
                    `SELECT * FROM items WHERE id=${item.itemId}`,
                    (err, response) => {
                        if (err)
                            return (
                                console.error(err),
                                res
                                    .status(500)
                                    .send({ error: "Internal server error" })
                            );
                        if (!response[0])
                            return console.error(
                                `Item not found, id:${item.itemId}`
                            );
                        const { itemName, priceInCents, img, description } =
                            response[0];

                        //formats items to fit stripe format
                        const stripeItem = {
                            price_data: {
                                unit_amount: priceInCents,
                                currency: "usd",
                                product_data: {
                                    name: itemName,
                                    images: [img],
                                    description: description,
                                },
                            },
                            quantity: item.quantity,
                        };
                        stripeItems.push(stripeItem);

                        if (item === cart[cart.length - 1]) {
                            pool.query(
                                `SELECT email FROM login WHERE id=${user_id}`,
                                async (err, response) => {
                                    if (err) return console.error(err);
                                    if (!response[0])
                                        return console.error("email not found");

                                    const { email } = response[0];

                                    try {
                                        const stripeSession =
                                            await Stripe.checkout.sessions.create(
                                                {
                                                    cancel_url:
                                                        websiteUrl + "/cart",
                                                    success_url:
                                                        websiteUrl + "/cart",
                                                    mode: "payment",
                                                    line_items: stripeItems,
                                                    customer_email: email,
                                                }
                                            );

                                        res.status(200).send({
                                            url: stripeSession.url,
                                        });
                                    } catch (e) {
                                        console.error(e);
                                        res.status(500).send({ error: e });
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
});

app.get("/api/buyCookieCart", (req, res) => {
    const cart = req.cookies.cookieCart;
    if (!cart)
        return res
            .status(404)
            .send({ error: "No cookie cart found, please login" });
    const cartArray = cartStringToArray(cart);

    const stripeItems = [];

    for (const item of cartArray) {
        const { item_id, quantity } = item;

        pool.query(
            `SELECT * FROM items WHERE id = ${item_id}`,
            async (error, response) => {
                if (error) return console.error(error);
                if (!response[0])
                    return console.error(`item not found, id: ${item_id}`);
                const { itemName, priceInCents, img, description } =
                    response[0];

                const stripeItem = {
                    price_data: {
                        unit_amount: priceInCents,
                        currency: "usd",
                        product_data: {
                            name: itemName,
                            images: [img],
                            description: description,
                        },
                    },
                    quantity: quantity,
                };

                stripeItems.push(stripeItem);

                //if every item formated, and put inside stripeItems array
                if (item == cartArray[cartArray.length - 1]) {
                    try {
                        const stripeSession =
                            await Stripe.checkout.sessions.create({
                                cancel_url: websiteUrl + "/cart",
                                success_url: websiteUrl + "/cart",
                                mode: "payment",
                                line_items: stripeItems,
                            });
                        res.status(200).send({ url: stripeSession.url });
                    } catch (e) {
                        console.error(e);
                        res.status(500).send({ error: e });
                    }
                }
            }
        );
    }
});

function cartStringToArray(cartString) {
    const cart1 = cartString.split(",");
    return cart1.map((item) => {
        const item_id = item.substring(0, item.indexOf("<"));
        const quantity = item.substring(item.indexOf("<") + 1, item.length);
        return { item_id, quantity };
    });
}

/////////// unexisting routes handling ///////////

function handleNonExistingRoutes() {
    app.all("/api/*", (req, res) =>
        res.status(404).send({ error: "Invalid api path" })
    );
    app.all("/private-api/*", (req, res) =>
        res.status(404).send({ error: "Invalid private api path" })
    );
    app.get("/*", (req, res) => res.redirect(302, "/"));
}

setTimeout(handleNonExistingRoutes, 500);

/////////// uncaught error handling ///////////

process.on("uncaughtException", (e) => console.error(e));

/////////// server init ////////////
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`listening on port ${PORT}...`));

/////////////// temporary //////////
const websiteUrl = "http://localhost:8080";
