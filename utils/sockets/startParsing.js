module.exports = function(socket, page, browser) {
  socket.on("start parsing", async (data) => {
    if (global.flags.authorized) {
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
            global.flags.errors = true;
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
                global.flags.errors = true;
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
                          token: global.flags.token,
                        }).then((vk) => {
                          /*
                      Этот код сначала авторизует вас по логину и паролю,
                      а затем отправит текстовое сообщение вам
                      */

                          // делаем запрос на GET api.vk.com/method/messages.send
                          vk.call("messages.send", {
                            user_id: global.flags.userid,
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
}