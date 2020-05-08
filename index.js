// creating server + connecting socket.io
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

// getting routes for express
const routes = require("./routes/mainRoutes");
// custom modules
const puppeteer = require("puppeteer");
const { exec } = require("child_process");
const cron = require("node-cron");
const bodyParser = require("body-parser");
let flags = require("./utils/obj");
// initializing sequelize
const Sequelize = require("sequelize");
const sequelize = new Sequelize("enot", "root", "", {
  dialect: "mysql",
  logging: false,
});
var browserAutoBuy; // making the browser's variable global
var page; // same for the authorizing page

// starting browser (crawler)
(async () => {
  browserAutoBuy = await puppeteer.launch({
    headless: false,
    // args:[  '--proxy-server=socks5://127.0.0.1:9050']
  });
  page = await browserAutoBuy.newPage();
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
    authorized: flags["authorized"],
    errors: flags["errors"],
  });
  socket.on("authorize in steam", async (data) => {
    // authorizing to steam and restoring all existing filter
    await page.type("#steamAccountName", data.steamLogin); // type user's login
    await page.type("#steamPassword", data.steamPassword); // type user's password
    await page.click("#SteamLogin");
    await page
      .waitForSelector(".newmodal") // event: on steam guard's modal window open
      .then(async () => {
        await console.log("[authorization] steam guard modal window opened");
        await page.type("#twofactorcode_entry", data.steamGuard); // type steam guard code
        await page.click(
          "#login_twofactorauth_buttonset_entercode > div.auth_button.leftbtn"
        ); // clicks verifying button
        await page
          .waitForSelector(".profile_header") // event: on profile's page username popup
          .then(() => {
            console.log("[authorization] successfully authorized!");
            sequelize
              .query(`SELECT * FROM filters`, {
                type: Sequelize.QueryTypes.SELECT,
              })
              .then(async (result) => {
                // get existing filters
                for (let i = 0; i < result.length; i++) {
                  // loop - for each filter
                  let parsingJSON = await JSON.parse(result[i].obj); // str to JSON
                  flags["parsingPages"][i] = await browserAutoBuy.newPage(); // insert into utils/obj.js -> parsingPages new page
                  await flags["parsingPages"][i].setViewport({
                    width: 1920,
                    height: 1080,
                  }); // set viewport, so it would show stickers on hover
                  await flags["parsingPages"][i].waitFor(2000); // to prevent bans from steam
                  await flags["parsingPages"][i].goto(parsingJSON.link); // get link on skin from filter
                  let data = await flags["parsingPages"][i].evaluate(() => {
                    const mouseoverEvent = new Event("mouseover"); // add event to hover on element
                    let stickers = {};
                    if (document.querySelector("#sticker_info")) {
                      // if there is stickers on first weapon
                      document.querySelector(
                        "#sticker_info"
                      ).parentNode.innerText = ""; // delete block with it
                    }
                    for (let j = 2; j <= 11; j++) {
                      // loop - all weapon rows on page
                      if (
                        document
                          .querySelector(
                            `#searchResultsRows > .market_listing_row:nth-child(${j}) > .market_listing_item_img_container > img`
                          )
                          .dispatchEvent(mouseoverEvent)
                      ) {
                        // hover on image preview, so stickers are available to get
                        if (document.querySelector("#sticker_info")) {
                          // if there are stickers on weapons
                          stickers[j] = document
                            .querySelector("#sticker_info")
                            .innerText.replace("Наклейка: ", "")
                            .split(", "); // insert into object 'stickers' key: [array of stickers]
                          // buy button document.querySelector("#searchResultsRows > .market_listing_row:nth-child(8) > .market_listing_price_listings_block > .market_listing_right_cell.market_listing_action_buttons > .market_listing_buy_button > a")
                        }
                      }
                    }
                    return stickers;
                  });
                  for (key in data) {
                    // after we got object with weapons & stickers - we check if they satisfy to our filters. loop - get arrays of stickers
                    // var needToBuy = false
                    var totalSum = 0; // total sum of stickers
                    for (let j = 0; j < data[key].length; j++) {
                      // loop - for each sticker in array
                      await sequelize
                        .query(
                          `SELECT price FROM  stickers WHERE name LIKE "%${data[key][j]}%"`,
                          { type: Sequelize.QueryTypes.SELECT }
                        )
                        .then(async (prices) => {
                          // get sticker's price from it's name
                          totalSum = totalSum + parseInt(prices[0].price); // getting total sum of sticker
                          /*
                                            ДЕРЬМОКОД
                                            getting stickers which are same, as from the filter
                                            */
                          for (keyJSON in parsingJSON) {
                            if (
                              keyJSON != "link" &&
                              keyJSON != "weaponPrice" &&
                              keyJSON != "stickersTotalPrice"
                            ) {
                              if (keyJSON.indexOf("NameSlotNo") !== -1) {
                                if (data[key][j] == parsingJSON[keyJSON]) {
                                  await console.log(
                                    "[found] needed sticker - " +
                                      data[key][j] +
                                      " - " +
                                      parsingJSON[keyJSON]
                                  );
                                }
                              }
                            }
                          }
                        });
                    }
                    if (totalSum >= parseInt(parsingJSON.stickersTotalPrice)) {
                      // if total sum of stickers is bigger than in filter - buy weapon.
                      await console.log(
                        "[found] total sum of stickers is bigger than in filter. id: " +
                          key
                      );
                    }
                  }
                }
              });
            io.emit("successfully authorized");
            flags["authorized"] = true;
          })
          .catch(() => {
            io.emit("failed to authorize");
          });
      })
      .catch(async () => {
        // if we get an error while authorizing - emitting it and reloading the page => input fields are getting empty
        await page.waitForSelector("#error_display").then(async () => {
          await page.reload();
          io.emit("failed to authorize");
        });
      });
  });
});

// cron.schedule('*/20 * * * * *', async () => {
//     if (flags["authorized"] === true) {
//         sequelize.query(`SELECT * FROM filters`, { type: Sequelize.QueryTypes.SELECT }).then(async result => { // get existing filters
//             for (let i = 0; i < result.length; i++) { // loop - for each filter
//                 let parsingJSON = await JSON.parse(result[i].obj) // str to JSON
//                 flags["parsingPages"][i].reload({
//                     waitUntil: ["networkidle0", "domcontentloaded"]
//                 }).then(async () => {
//                     let data = await flags["parsingPages"][i].evaluate(() => {
//                         const mouseoverEvent = new Event('mouseover') // add event to hover on element
//                         let stickers = {}
//                         if (document.querySelector("#sticker_info")) { // if there is stickers on first weapon
//                             document.querySelector("#sticker_info").parentNode.innerText = "" // delete block with it
//                         }
//                         for (let j = 2; j <= 11; j++) { // loop - all weapon rows on page
//                             if (document.querySelector(`#searchResultsRows > .market_listing_row:nth-child(${j}) > .market_listing_item_img_container > img`).dispatchEvent(mouseoverEvent)) { // hover on image preview, so stickers are available to get
//                                 if (document.querySelector("#sticker_info")) { // if there are stickers on weapons
//                                     stickers[j] = document.querySelector("#sticker_info").innerText.replace("Наклейка: ", "").split(", ") // insert into object 'stickers' key: [array of stickers]
//                                     // buy button document.querySelector("#searchResultsRows > .market_listing_row:nth-child(8) > .market_listing_price_listings_block > .market_listing_right_cell.market_listing_action_buttons > .market_listing_buy_button > a")
//                                 }
//                             }
//                         }
//                         return stickers
//                     })
//                     for (key in data) { // after we got object with weapons & stickers - we check if they satisfy to our filters. loop - get arrays of stickers
//                         // var needToBuy = false
//                         var totalSum = 0 // total sum of stickers
//                         for (let j = 0; j < data[key].length; j++) { // loop - for each sticker in array
//                             await sequelize.query(`SELECT price FROM  stickers WHERE name LIKE "%${data[key][j]}%"`, { type: Sequelize.QueryTypes.SELECT }).then(async prices => { // get sticker's price from it's name
//                                 totalSum = totalSum + parseInt(prices[0].price) // getting total sum of sticker
//                                 /*
//                                     ДЕРЬМОКОД
//                                     getting stickers which are same, as from the filter
//                                 */
//                                 for (keyJSON in parsingJSON) {
//                                     if (keyJSON != "link" && keyJSON != "weaponPrice" && keyJSON != "stickersTotalPrice") {
//                                         if (keyJSON.indexOf("NameSlotNo") !== -1) {
//                                             if (data[key][j] == parsingJSON[keyJSON]) {
//                                                 await console.log("[found] needed sticker - " + data[key][j] + " - " + parsingJSON[keyJSON])
//                                             }
//                                         }
//                                     }
//                                 }

//                             })
//                         }
//                         if (totalSum >= parseInt(parsingJSON.stickersTotalPrice)) {  // if total sum of stickers is bigger than in filter - buy weapon.
//                             await console.log("[found] total sum of stickers is bigger than in filter. id: " + key)
//                         }
//                     }
//                 })
//             } // document.querySelectorAll("#sticker_info") // get stickers info - example: Наклейка: Astralis | Лондон 2018, Xyp9x | Берлин 2019
//         })
//     }
// })

// !!! notes
// SELECT * FROM `stickers` WHERE name LIKE "%100%"
// error #message, #BG_bottom, #BG_top, #mainContents
