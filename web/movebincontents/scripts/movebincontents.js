/**
 * This variableholds the token for accessing the Cherwell API
 */
var token={
    access:"",
    refresh:"",
    expires:Date.now()
};

var sourceBin ={
    recID: "",
    barCode: "",
    productID: "",
    qty: 0,
    shelf: ""
}

var destinationBin ={
    recID: "",
    barCode: "",
    productID: "",
    qty: 0,
    shelf: ""
}

/**
 * When the document is loaded we need to initialise various controls.
 */
$(document).ready(function () {
    $("#sourcebinbarcode").keydown( handleSourceTab);
    $("#destinationbinbarcode").keydown( handleDestinationTab);
    loadToken();
});

function moveContents() {
    if (prompt("Move all the contents?")) {
        alert("Contents Moved!");
    }
}

function findSourceBin(barcode) {
    findBin(barcode, populateSourceBin);
}

function findDestinationBin(barcode) {
    findBin(barcode, populateDestinationBin);
}

function handleSourceTab(event) {
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        barcode = $("#sourcebinbarcode");
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Tab between serial and bin until both have at least 6 digits.
        if (barcode.val().length > 3) {
            findSourceBin(barcode.val());
        }
        $("#transferDiv").css('visibility', 'hidden');
    }
}

function handleDestinationTab(event) {
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        sourcebarcode = $("#sourcebinbarcode");
        destinationbarcode = $("#destinationbinbarcode")
            // Don't let the system automatically move to another control
        event.preventDefault();
        // Tab between serial and bin until both have at least 6 digits.
        if ((sourcebarcode.val().length > 3) && (destinationbarcode.val().length > 3)){
            findDestinationBin(destinationbarcode.val());
        }
        $("#transferDiv").css('visibility', 'hidden');
    }
}

function clearBin(bin) {
    $(bin).val("");
    $(bin).attr("recID","");
}

function getBinBarcode(bin) {
    return $(bin).val();
}

function findBin(bin, populateFunction){
    body = { busObId:BinObj,
                fields:[Bin_Bin,Bin_Shelf,Bin_RecID,Bin_ProdID,Bin_Qty],
                filters:[{fieldId:Bin_Bin,
                        operator:"eq",
                        value:bin}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateFunction)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function getProductByRecID(recID) {
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"GET",
                url: "/cherwellapi/api/V1/getbusinessobject/busobid/" + ProductObj + "/busobrecid/" + recID,
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return xhr.responseJSON.busObPublicId;
            } else {
                alert( "Product not found: " + xhr.status + "\n" + xhr.responseText);
                return "";
            }
        }
    } catch (e) {
        alert(e);
    }
    return "";
}

function populateSourceBinContents(binRecord) {
    $("#sourceWaiting").css('display','inline');
    $("#sourceList").empty();
    sourceBin.recID = binRecord.fields[2].value;
    sourceBin.barCode = binRecord.fields[0].value;
    sourceBin.productID = binRecord.fields[3].value;
    sourceBin.qty = parseInt(binRecord.fields[4].value, 10);
    if (sourceBin.qty != 0) {
        prod = getProductByRecID(sourceBin.productID);
        $("#sourceList").append("<li>" + sourceBin.qty + " x " + prod + "</li>");    
    }
    loadItemsInBin(binRecord, populateSourceList);
}

function populateDestinationBinContents(binRecord) {
    $("#destinationWaiting").css('display','inline');
    $("#destinationList").empty();
    if (destinationBin.qty != 0) {
        prod = getProductByRecID(destinationBin.productID);
        $("#destinationList").append("<li>" + destinationBin.qty + " x " + prod + "</li>");    
    }
    loadItemsInBin(binRecord, populateDestinationList);
}

function loadItemsInBin(binRecord, populateFunction) {
    body = { busObId:ConfigObj,
        fields:[Cfg_RecID,Cfg_Model,Cfg_Serial],
        filters:[{fieldId:Cfg_Bin,
                operator:"eq",
                value:binRecord.fields[0].value}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateFunction)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }

}

function populateSourceList(data, status, xhr) {
    data.businessObjects.forEach(function(item, index) {
        $('#sourceList').append("<li id='" + item.fields[0].value + "'>" + item.fields[1].value + " (" + item.fields[2].value + ")</li>")
    });
    $("#sourceWaiting").css('display','none');
    enableTransferButton();
}

function populateDestinationList(data, status, xhr) {
    data.businessObjects.forEach(function(item, index) {
        $('#destinationList').append("<li id='" + item.fields[0].value + "'>" + item.fields[1].value + " (" + item.fields[2].value + ")</li>")
    });
    $("#destinationWaiting").css('display','none');
    enableTransferButton();
}

function enableTransferButton() {
    sourcelist = $("#sourceList");
    destinationList = $("#destinationList");
    if (($("#sourcebinbarcode").val().length > 0) && ($("#destinationbinbarcode").val().length > 0) && ($("#sourcebinbarcode").val() != $("#destinationbinbarcode").val())) {
        if ($('ul#sourceList li').length > 0) {
            $("#transferDiv").css('visibility', 'visible');
        }
    }
}

function populateSourceBin(data, status, xhr) {
    var records = data.businessObjects;
    if (records.length == 1) {
        sourceBin.barCode = records[0].fields[0].value;
        sourceBin.shelf = records[0].fields[1].value;
        sourceBin.recID = records[0].fields[2].value;
        sourceBin.productID = records[0].fields[3].value;
        sourceBin.qty = parseInt(records[0].fields[4].value, 10);
        $('#sourcebinbarcode').attr('recID', sourceBin.recID);
        $('#destinationbinbarcode').focus();
        populateSourceBinContents(records[0]);
    } else {
        alert("Bin was not found!");
        clearBin('#sourcebinbarcode');
        $('#sourcebinbarcode').focus();
    }
}

function populateDestinationBin(data, status, xhr) {
    var records = data.businessObjects;
    if (records.length == 1) {
        destinationBin.barCode = records[0].fields[0].value;
        destinationBin.shelf = records[0].fields[1].value;
        destinationBin.recID = records[0].fields[2].value;
        destinationBin.productID = records[0].fields[3].value;
        destinationBin.qty = parseInt(records[0].fields[4].value, 10);
        $('#Destinationbinbarcode').attr('recID', destinationBin.recID);
        populateDestinationBinContents(records[0]);
    } else {
        alert("Bin was not found! A new bin will be created.");
        enableTransferButton();
    }
}

function clearForm() {
    clearBin("#sourcebinbarcode");
    clearBin("#destinationbinbarcode");
    destinationBin.recID = "";
    destinationBin.barCode = "";
    destinationBin.qty = 0;
    destinationBin.productID = "";
    destinationBin.shelf = "";
    sourceBin.recID = "";
    sourceBin.barCode = "";
    sourceBin.qty = 0;
    sourceBin.productID = "";
    sourceBin.shelf = "";
    $("#sourceList").empty();
    $("#destinationList").empty();
    $("#transferDiv").css('visibility','hidden');
    $("#sourcebinbarcode").focus();
}

function transfer() {
    if ($("ul#destinationList li").length > 0) {
        if (!confirm("Add the contents of the source bin to the destination bin?")) {
            return;
        }
    }

    var body = {busObId:BinObj,
                fields:[
                    { dirty:true, fieldId: Bin_ProdID, value: sourceBin.productID },
                    { dirty:true, fieldId: Bin_Qty, value: sourceBin.qty }
                ],
                persist: true
            };

    try {
        if (destinationBin.recID != "") {
            body.busObRecId = destinationBin.recID;
        } else {
            destinationBin.barCode = $("#destinationbinbarcode").val();
            body.fields.push({ dirty: true, fieldId: Bin_Bin, value:destinationBin.barCode})
        }
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});

            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                dataType: 'json',
                data: JSON.stringify(body),
                async: false
            });
            if (xhr.status != 200) {
                alert( "Move to bin failed: " + xhr.status + "\n" + xhr.responseText);
                return;
            }
            body.busObRecId = sourceBin.recID;
            body.fields = [
                { dirty: true, fieldId: Bin_ProdID, value:""},
                { dirty: true, fieldId: Bin_Shelf, value:""},
                { dirty: true, fieldId: Bin_Qty, value:0}
            ];
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});

            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                dataType: 'json',
                data: JSON.stringify(body),
                async: false
            });
            if (xhr.status != 200) {
                alert( "Move inventory to bin failed: " + xhr.status + "\n" + xhr.responseText);
                return;
            }
            items = $("ul#sourceList li");
            items.each(function(index, item) {
                if ((item.id != undefined) && (item.id != "")) {
                    var itemBody = {
                        busObId:ConfigObj,
                        busObRecId: item.id,
                        fields:[
                            { dirty:true, fieldId: Cfg_Bin, value: destinationBin.barCode }
                        ],
                        persist: true
                    };
                    $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                    'Content-Type':"application/json"}});

                    $.ajaxSetup({headers:{'Content-Type':"application/json"}});
                    xhr = $.ajax({
                        type:"POST",
                        url: "/cherwellapi/api/V1/savebusinessobject",
                        dataType: 'json',
                        data: JSON.stringify(itemBody),
                        async: false
                    });
                    if (xhr.status != 200) {
                        alert( "Move config item to bin failed: " + xhr.status + "\n" + xhr.responseText);
                        return;
                    }
        
                }
            });
            clearForm();
        }
    } catch (e) {
        alert(e);
    }
}

function saveComplete() {
    alert("Saved!");
    clearForm();
}