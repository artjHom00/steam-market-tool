const routes = require("express").Router();
const Sequelize = require("sequelize");
const puppeteer = require("puppeteer");
let flags = require("../utils/obj");
const sequelize = new Sequelize("steam", "root", "", {
  dialect: "mysql",
});
routes.get("/", (req, res) => {
  res.render("index");
});
routes.get("/login", (req, res) => {
  if (req.query) {
  }
});
module.exports = routes;
