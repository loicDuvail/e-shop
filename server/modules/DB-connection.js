const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
    user: "root",
    host: "localhost",
    database: "store",
    password: process.env.MYSQL_PASSWORD,
});

module.exports = pool;
