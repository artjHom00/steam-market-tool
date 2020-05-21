console.clear();
// creating server + connecting socket.io
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

// getting routes for express
const routes = require("./routes/mainRoutes");
// custom modules
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const easyvk = require("easyvk");
let flags = require("./utils/flags");
var browser; // making the browser's variable global
var page; // same for the authorizing page

// starting browser (crawler)
(async () => {
  browser = await puppeteer.launch({
    args: ["--window-size=1920,1080"],
    headless: false
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
    authorized: flags["authorized"],
    errors: flags["errors"],
  });
  socket.on("authorize in steam", async (data) => {
    // authorizing to steam and restoring all existing filter (code might be a lil bit sloppy because of attracting with DOM)
    await page.type("#steamAccountName", data.steamLogin); // type user's login
    await page.type("#steamPassword", data.steamPassword); // type user's password
    await page.click("#SteamLogin");
    await page
      .waitForSelector(".newmodal") // event: on steam guard's modal window open
      .then(async () => {
        await page.type("#twofactorcode_entry", data.steamGuard); // type steam guard code
        await page.click(
          "#login_twofactorauth_buttonset_entercode > div.auth_button.leftbtn"
        ); // clicks verifying button
        await page
          .waitForSelector(".profile_header") // event: on profile's page username popup
          .then(() => {
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
  socket.on("start parsing", async (data) => {
    if (flags.authorized) {
      /* data */
      let weapons = {};
      /* open new crawler page */
      const marketPage = await browser.newPage();
      await marketPage.setViewport({
        width: 1920,
        height: 1080,
      });
      /* go to STICKERS filter and search ONLY weapon skins */
      await marketPage.goto(
        "https://steamcommunity.com/market/search?q=STICKER&descriptions=1&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Weapon%5B%5D=any&category_730_Rarity%5B%5D=tag_Rarity_Common_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Rare_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Uncommon_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Mythical_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Legendary_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Ancient_Weapon&appid=730"
      );
      /* get amount of pages to parse */
      let pagesAmount = await marketPage.evaluate(() => {
        return parseInt(
          document.querySelectorAll(".market_paging_pagelink")[
            document.querySelectorAll(".market_paging_pagelink").length - 1
          ].innerText
        );
      });
      /* go through all pages */
      for (let i = data.page; i <= pagesAmount; i++) {
        await marketPage.goto(
          `https://steamcommunity.com/market/search?q=STICKER&descriptions=1&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Weapon%5B%5D=any&category_730_Rarity%5B%5D=tag_Rarity_Common_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Rare_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Uncommon_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Mythical_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Legendary_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Ancient_Weapon&appid=730#p${i}_price_asc`
        );
        /* user's data.delay */
        await marketPage.waitFor(data.delay * 1000);
        /* pushes into array weapon links & gets its amount (i mean how much weapons on the page) */
        let skinsPage = await marketPage
          .evaluate(() => {
            let data = [];
            for (
              let d = 0;
              d < document.querySelectorAll(".market_listing_row_link").length;
              d++
            ) {
              data.push(
                document.querySelectorAll(".market_listing_row_link")[d].href
              );
            }
            return data;
          })
          .catch(() => {
            flags.errors = true;
          });
        /* goes through all weapons */
        for (let j = 0; j < skinsPage.length; j++) {
          await marketPage.goto(skinsPage[j]).then(async () => {
            /* waits */
            await marketPage.waitFor(data.delay * 1000);
            /* gets how much weapons on the current page */
            let skinsAmount = await marketPage
              .evaluate(() => {
                return parseInt(
                  document.querySelectorAll(".market_listing_row").length
                );
              })
              .catch(() => {
                flags.errors = true;
              });
            /* goes through all weapons  */
            for (let k = 2; k <= skinsAmount; k++) {
              /* hovers image to get additional info (especially stickers) */
              await marketPage
                .hover(
                  `.market_listing_row:nth-child(${k}) > .market_listing_item_img_container > img`
                )
                .then(async () => {
                  /* gets array of stickers */
                  let weaponStickers = await marketPage.evaluate(() => {
                    return document
                      .querySelectorAll("#sticker_info")[1]
                      .innerText.trim()
                      .split("Наклейка: ")[1]
                      .split(", ");
                  });
                  /* inserts into defined earlier object */
                  weapons[skinsPage] = weaponStickers;
                  let repeats = {};
                  for (let b = 0; b < weaponStickers.length; b++) {
                    if (repeats[weaponStickers[b]]) {
                      repeats[weaponStickers[b]] += 1;
                      if (repeats[weaponStickers[b]] == 3) {
                        let prices = await marketPage.evaluate((k) => {
                          let arr = [];
                          arr.push(
                            document
                              .querySelector(
                                `#market_commodity_buyrequests > span:nth-child(3)`
                              )
                              .innerText.trim()
                          );
                          arr.push(
                            document
                              .querySelector(
                                `.market_listing_row:nth-child(${k}) > .market_listing_price_listings_block > .market_listing_right_cell.market_listing_their_price > .market_table_value > .market_listing_price.market_listing_price_with_fee`
                              )
                              .innerText.trim()
                          );
                          return arr;
                        }, k);
                        easyvk({
                          token: flags.token,
                        }).then((vk) => {
                          /*
                      Этот код сначала авторизует вас по логину и паролю,
                      а затем отправит текстовое сообщение вам
                      */

                          // делаем запрос на GET api.vk.com/method/messages.send
                          vk.call("messages.send", {
                            user_id: flags.userid,
                            message: `[cs:go] market-tool\n🎊 Нашли новый скин!\n📌 Ссылка: ${
                              skinsPage[j]
                            }\n📌 Ячейка №${k - 1}\n
                        Первоначальная цена: ${prices[0]}\n
                        Цена со стикером: ${prices[1]}`,
                            random_id: easyvk.randomId(),
                          });
                        });
                      }
                    } else {
                      repeats[weaponStickers[b]] = 1;
                    }
                  }
                })
                .catch(() => {
                  console.log("Error while parsin'. Don't worry, dats ok!");
                });
            }
          });
        }
      }
      await marketPage.close();
      await browser.close();
    } else {
      io.emit("failed to parse");
    }
  });
});
