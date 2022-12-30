const passwordConfirmationInput = document.getElementById(
    "password-confirmation-input"
);
const passwordInput = document.getElementById("password-input");
const emailInput = document.getElementById("email-input");
const nameInput = document.getElementById("name-input");
const submitBtn = document.getElementById("submit-button");

passwordConfirmationInput.oninput = () => {
    if (passwordConfirmationInput.value == passwordInput.value)
        return (passwordConfirmationInput.minLength = 1);
    passwordConfirmationInput.minLength = 1000;
};

function signUp() {
    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const passwordConfirmation = passwordConfirmationInput.value;

    if (!name || !email || !password || !passwordConfirmation)
        return alert("fill every fields to continue");

    if (password !== passwordConfirmation)
        return alert("password confirmation doesn't match password");

    let valid = true;

    document.querySelectorAll("input").forEach((input) => {
        if (!input.checkValidity()) return (valid = false);
    });

    if (!valid) return alert("invalid field content");

    const salt = saltGen(20);
    const hash = SHA256(password + salt);

    fetch("/api/createAccount", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, hash, salt }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.error == "email already in use")
                return alert("email already in use");

            if (data.error)
                return (
                    alert("account creation failed"), console.log(data.error)
                );

            if (data.ok) {
                alert(data.ok);

                fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        if (data.error)
                            return alert(
                                "failed to login, try loging in directly"
                            );
                        window.location.replace("/");
                    });
            }
        });
}

submitBtn.onclick = signUp;

function saltGen(length) {
    let salt = "";
    const chars =
        "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890";
    for (let i = 0; i < length; i++) {
        salt += chars[parseInt(Math.random() * chars.length)];
    }
    return salt;
}

///password visibility

const eyeContainer1 = document.getElementById("eye-container1");
const closedEye1 = document.getElementById("closed-eye1");
const openedEye1 = document.getElementById("opened-eye1");

let toggle1 = false;

eyeContainer1.onclick = () => {
    toggle1 = !toggle1;
    if (toggle1) {
        closedEye1.style.display = "none";
        openedEye1.style.display = "block";
        passwordInput.type = "text";
    } else {
        closedEye1.style.display = "block";
        openedEye1.style.display = "none";
        passwordInput.type = "password";
    }
};

const eyeContainer2 = document.getElementById("eye-container2");
const closedEye2 = document.getElementById("closed-eye2");
const openedEye2 = document.getElementById("opened-eye2");

let toggle2 = false;

eyeContainer2.onclick = () => {
    toggle2 = !toggle2;
    if (toggle2) {
        closedEye2.style.display = "none";
        openedEye2.style.display = "block";
        passwordConfirmationInput.type = "text";
    } else {
        closedEye2.style.display = "block";
        openedEye2.style.display = "none";
        passwordConfirmationInput.type = "password";
    }
};
