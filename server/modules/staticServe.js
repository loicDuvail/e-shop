const fs = require("fs");
const path = require("path");

module.exports = (app) =>
    function serve(parent, absParentPath) {
        absParentPath ||= path.join(__dirname, parent);
        fs.readdir(absParentPath, (err, files) => {
            if (err) return console.error(err);
            files.forEach((file) => {
                const absFilePath = path.join(absParentPath, file);
                if (fs.statSync(absFilePath).isDirectory())
                    return serve(file, absFilePath);
                if (parent === "public") {
                    file = file.replace(".html", "");
                    app.get(`/${file}`, (req, res) =>
                        res.sendFile(absFilePath)
                    );
                } else {
                    app.get(`/${parent}/${file}`, (req, res) => {
                        res.sendFile(absFilePath);
                    });
                }
            });
        });
    };
