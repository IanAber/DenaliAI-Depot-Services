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
    $("#serialbarcode").keydown( handleSerialTab);
    $("#binbarcode").keydown( handleBinTab);
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

function handleSerialTab(event) {
    serial = $("#serialbarcode");
    bin = $("#binbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Tab between serial and bin until both have at least 6 digits.
        if (serial.val().length > 6) {
            findAsset(serial.val());
        }
    }
}

function handleBinTab(event) {
    bin = $("#binbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        recID = $("#RecID").val();
        if ((bin.val().length > 4) && (recID.length==42)) {
            addToBin(bin.val(), recID);
        }
    }
}

function findAsset(serial){
    body = { busObId:ConfigObj,
                fields:[Cfg_Model,Cfg_RecID,Cfg_Serial,Cfg_Manufacturer],
                filters:[{fieldId:Cfg_Serial,
                        operator:"eq",
                        value:serial}]
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
        var model = records[0].fields[0].value;
        var recId = records[0].fields[1].value;
        var serial = records[0].fields[2].value;
        var manufacturer = records[0].fields[3].value;
        $('#assetDescription').text(manufacturer + " - " + model);
        $('#RecID').val(recId);
        $('#binbarcode').focus();
    } else {
        $('#assetDescription').text("Item not found!");
        $('#RecID').val("");
        $('#serialbarcode').val("");
        $('#serialbarcode').focus();
    }
}

function clearForm() {
    $("#serialbarcode").val("");
    $("#assetDescription").text("");
    $("#RecID").val("");
    $("#binbarcode").val("");
    $("#serialbarcode").focus();
}

function addToBin() {

    var body = {busObId:ConfigObj,
                busObRecId: $('#RecID').val(),
                fields:[
                    { dirty:true, fieldId: Cfg_Bin, value: $('#binbarcode').val() }
                ],
                persist: true
            };

    if ($("#RecID").val() != "") {
        try {
            if (refreshToken()) {
                $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                    'Content-Type':"application/json"}});
                $.post("/cherwellapi/api/V1/savebusinessobject", JSON.stringify(body), saveComplete)
                    .fail(function (xhr, status, error) {
                        alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                    });
            }
        } catch (e) {
            alert(e);
        }            
    }
}

function saveComplete(data, status, xhr) {
    if (xhr.status == 200) {
        $("#list").prepend("<li>" + $("#assetDescription").text() + " serial #" + $("#serialbarcode").val() + " ===> bin #" + $("#binbarcode").val() + "</li>");
        clearForm();
    } else {
        alert("Failed!\n" + xhr.responseText);
    }
}
