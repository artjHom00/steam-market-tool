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
    headless: false,
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
  socket.on("start parsing", async (delay) => {
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
      for (let i = 1; i <= pagesAmount; i++) {
        await marketPage.goto(
          `https://steamcommunity.com/market/search?q=STICKER&descriptions=1&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Weapon%5B%5D=any&category_730_Rarity%5B%5D=tag_Rarity_Common_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Rare_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Uncommon_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Mythical_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Legendary_Weapon&category_730_Rarity%5B%5D=tag_Rarity_Ancient_Weapon&appid=730#p${i}_default_desc`
        );
        /* user's delay */
        await marketPage.waitFor(delay * 1000);
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
            await marketPage.waitFor(delay * 1000);
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
            for (let g = 2; g <= skinsAmount; g++) {
              /* hovers image to get additional info (especially stickers) */
              await marketPage
                .hover(
                  `.market_listing_row:nth-child(${g}) > .market_listing_item_img_container > img`
                )
                .then(async () => {
                  /* gets array of stickers */
                  let weaponStickers = await marketPage.evaluate(async () => {
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
                        easyvk({
                          token: flags.token,
                        }).then(async (vk) => {
                          /*
                          Этот код сначала авторизует вас по логину и паролю,
                          а затем отправит текстовое сообщение вам
                          */

                          // делаем запрос на GET api.vk.com/method/messages.send
                          await vk.call("messages.send", {
                            user_id: flags.userid,
                            message: `[cs:go] market-tool\n🎊 Нашли новый скин!\n📌 Ссылка: ${
                              skinsPage[j]
                            }\n📌 Ячейка №${g - 1}`,
                            random_id: easyvk.randomId(),
                          });
                        });
                      }
                    } else {
                      repeats[weaponStickers[b]] = 1;
                    }
                  }
                  /*
                  TODO:
                  CHECK FOR MULTIPLE STICKERS & SEND 'EM
                  */
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
// 226830567
