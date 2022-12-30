const Sessions = require("./sessions");

module.exports = (privatePaths) =>
    function auth(req, res, next) {
        const { path } = req;

        //if path is not private, skip to next middleware
        if (
            !privatePaths.some(
                (privatePath) =>
                    privatePath === path.substring(0, privatePath.length)
            )
        )
            return next();

        //else, require authentification to continue
        const { session_id } = req.cookies;
        if (!Sessions.isLoggedIn(session_id))
            return res
                .status(401)
                .send({ error: "unauthorized, please log in" });
        next();
    };
