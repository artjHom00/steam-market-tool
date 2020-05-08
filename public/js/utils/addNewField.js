let addNewFieldName = () => {
    let inputAmount = $("#newFields").children().length
    $("#newFields").append(`<input type="text" name="NameSlotNo${inputAmount}" placeholder="sticker name for slot no. ${inputAmount}" autocomplete="off"/>&nbsp;`)
}
let addNewFieldPrice = () => {
    let inputAmount = $("#newFields").children().length
    $("#newFields").append(`<input type="text" name="PriceSlotNo${inputAmount}" placeholder="min. price for slot no. ${inputAmount}" autocomplete="off"/>&nbsp;`)
}