console.clear();
// creating server + connecting socket.io
let express = require("express");
let app = express();
let server = require("http").Server(app);
let io = require("socket.io")(server);

// getting routes for express
let routes = require("./routes/mainRoutes");
// custom modules
let puppeteer = require("puppeteer");
let eventsLoader = require("./utils/sockets/loader");
let bodyParser = require("body-parser");
let easyvk = require("easyvk");
let flags = require("./utils/flags");

var browser; // making the browser's variable global
var page; // same for the authorizing page

// starting browser (crawler)
(async () => {
  browser = await puppeteer.launch({
    args: ["--window-size=1920,1080"],
  });

  page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  await page.goto("https://steamcommunity.com/login/home/");
})();

// setting up app"s view engine
app.set("view engine", "ejs");
// making assets files visible
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// app routing
app.use("/", routes);
// start server
server.listen(80);
console.log("[server] server is started!");


io.on("connection", (socket) => {

  io.emit("restore status of authorization", {
    // pass the statuses of authorization and errors
    authorized: global.flags["authorized"],
    errors: global.flags["errors"],
  });

  eventsLoader(socket, page, browser);
});
