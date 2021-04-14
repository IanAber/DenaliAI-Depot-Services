/**
 * This variableholds the token for accessing the Cherwell API
 */
var token={
    access:"",
    refresh:"",
    expires:Date.now()
};

/**
 * Represents the JSON packet sent to Cherwell on save.
 */
var data={
    tracking:"",
    bin:"",
    nsdata:[],
    serials:[],
};

/**
 * When the document is loaded we need to initialise various controls.
 */
$(document).ready(function () {
    // Login form Click function
    $("#binbarcode").keydown( handleBinTab);
    $("#shelfbarcode").keydown( handleShelfTab);
    loadToken();
});

function addToBin() {
    serial = $("#serialbarcode");
    bin = $("#binbarcode");
    if ((bin.val().length > 4) && (serial.val().length > 6)) {

        $("#serialNumbers").jqxGrid('addrow', null, {serial: serial.val(), description: "", bin: bin.val()});
        getSerialisedDescription(serial.val());
        serial.val("");
        bin.val("");
        serial.focus();
    }
}

function handleBinTab(event) {
    barcode = $("#binbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Tab between serial and bin until both have at least 6 digits.
        if (barcode.val().length > 6) {
            findBin(barcode.val());
        }
    }
}

function handleShelfTab(event) {
    bin = $("#binbarcode");
    shelf = $("#shelfbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        if ((bin.val().length > 4) && (shelf.val().length > 6)) {
            addToShelf(bin.val(), shelf.val(), $('#binId').val());
        }
    }
}

function findBin(barcode){
    body = { busObId:BinObj,
                fields:[Bin_Bin,Bin_Shelf,Bin_RecID],
                filters:[{fieldId:Bin_Bin,
                        operator:"eq",
                        value:barcode}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateDescription)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function populateDescription(data, status, xhr) {
    var records = data.businessObjects;
    if (records.length == 1) {
        var bin = records[0].fields[0].value;
        var shelf = records[0].fields[1].value;
        var id = records[0].fields[2].value;
        $('#binFound').text("Bin Located on shelf - " + shelf);
        $('#binId').val(id);
    } else {
        $('#binFound').text("Bin not found! A new bin will be created.");
        $('#binId').val("");

    }
    $('#shelfbarcode').focus();
}

function clearForm() {
    $("#binbarcode").val("");
    $("#binFound").text("");
    $('#newBin').val(false);
    $("#shelfbarcode").val("");
    $("#binbarcode").focus();
}

function addToShelf(bin, shelf, binID) {

    var body = {busObId:BinObj,
                busObRecId: binID,
                fields:[
                    { dirty:true, fieldId: Bin_Bin, value: bin },
                    { dirty:true, fieldId: Bin_Shelf, value: shelf }
                ],
                persist: true
            };

            try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/savebusinessobject", JSON.stringify(body), saveComplete)
                .fail(function (xhr, status, error) {
                    if (xhr.responseJSON != undefined) {
                        alert(xhr.responseJSON.errorMessage);
                    } else {
                        alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText);
                    }
                    clearForm();
                });
        }
    } catch (e) {
        alert(e);
    }            
}

function saveComplete(data, status, xhr) {
    if (xhr.status == 200) {
        $("#list").prepend("<li>Bin:" + $("#binbarcode").val() + " moved to Shelf: " + $("#shelfbarcode").val() + "</li>");
    } else {
        alert("Failed!\n" + xhr.responseText);
    }
    clearForm();
}
