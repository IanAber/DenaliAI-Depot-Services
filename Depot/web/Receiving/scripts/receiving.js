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
    $('.login-form span').on('click', function() {
        if ($(this).children('input').attr('checked')) {
            $(this).children('input').attr('checked', false);
            $(this).removeClass('checked');
        } else {
            $(this).children('input').attr('checked', true);
            $(this).addClass('checked');
        }
    });

    /**
     * Data source for the non-serialised asset counts
     */
    var source =
    {
        localdata: data.nsdata,
        datatype: "array",
        updaterow: function (rowid, rowdata, commit) {
            commit(true);
        },
        datafields:
        [
            { name: 'description', type: 'string' },    // Model from the product table
            { name: 'good_count', type: 'number' },
            { name: 'bad_count', type: 'number' },
        ]
    };

    /**
     * Data source for the serialised asset information
     */
    var serials = 
    {
        localdata: data.serials,
        datatype: "array",
        updaterow: function (rowid, rowdata, commit) {
            commit(true);
        },
        datafields:
        [
                {name: 'serial', type: 'string' },      // Scanned serial number
                {name: 'description', type:'string' },  // Model from the configuration item is found
                {name: 'recid', type:'string' }         // RecID of the configurtion item if found
        ]
    };

    var dataAdapter = new $.jqx.dataAdapter(source);
    var serialAdapter = new $.jqx.dataAdapter(serials);

    // initialize jqxGrid for non-serialised parts
    $("#nsgrid").jqxGrid(
    {
        width: "100%",
        source: dataAdapter,
        editable: true,
        enabletooltips: true,
        selectionmode: 'none',
        rowsheight: 40,
        autoheight: true,
        columns: [
            { text: 'Description', datafield: 'description', editable: false, width: "auto" },
            { text: 'Good', editable: false, columntype: 'text', datafield: 'addGood', width: "5%", cellsrenderer: function() {
                    return '<div class="button"><img src="/images/check.png" /></div>';
                }
            },
            { text: 'Good Count', datafield: 'good_count', columntype: 'numberinput', width: "10%", cellsalign: 'center',
                createeditor: function (row, cellvalue, editor) {
                    editor.jqxNumberInput({ decimalDigits: 0, digits: 3 });
                }
            },
            { text: 'Bad', editable: false, columntype: 'text', datafield: 'addBad', width: "5%", cellsrenderer: function() {
                    return '<div class="button"><img src="/images/red-cross.png" /></div>';
                }
            },
            { text: 'Bad Count', datafield: 'bad_count', columntype: 'numberinput', width: "10%", cellsalign: 'center',
                createeditor: function (row, cellvalue, editor) {
                    editor.jqxNumberInput({ decimalDigits: 0, digits: 3 });
                }
            }
        ]
    });

    // OnClick handler for the non-serialised parts grid
    $("#nsgrid").on("cellclick", function (event) {
        row = event.args.rowindex;
        switch (event.args.datafield) {
            case 'addGood' : incrementCount(row, 'good_count');
                $("#nsgrid").jqxGrid('refresh');
                break;
            case 'addBad' : incrementCount(row, 'bad_count');
                $("#nsgrid").jqxGrid('refresh');
                break;
        }
        $("#serialbarcode").focus();
    });

    // Initialise the serialised assets grid
    $("#serialNumbers").jqxGrid(
    {
        width: "100%",
        source: serialAdapter,
        editable: false,
        enabletooltips: false,
        selectionmode: 'none',
        rowsheight: 28,
        autoheight: true,
        columns: [
            { text: 'Serial Number', datafield: 'serial', editable: true, width: 300, font_size: "large" }, // Scanned serial number
            { text: 'Description', datafield: 'description', editable: false, width: 700 },                 // Model from the configuration item table
            { text: 'Bin', datafield: 'bin', editable: true, width: 250, font_size: "large"},               // Scanned bin barcode
            { text: 'RecID', datafield: 'recid', editable: false, width: 100 }                              // RecID from the configuration item table
        ]
    });
    $("#serialNumbers").jqxGrid('hidecolumn','recid');
    $("#serialNumbers").on('rowclick', deleteSerial);
    $("#trackingbarcode").keydown( handleTrackingTab);
    $("#serialbarcode").keydown( handleSerialTab);
    $("#binbarcode").keydown( handleSerialTab);
    loadToken();
    getCustomers();
});

function resizeNSPartsGrid() {
    width = window.innerWidth;
    $("#nsgrid").jqxGrid()
}
function incrementCount(row, column) {
    $("#nsgrid").jqxGrid('setcellvalue', row, column, $("#nsgrid").jqxGrid('getcellvalue', row, column) + 1);
    window.setTimeout(gotoSerial, 200);
}
// Require at least 6 characters
function changeTracking() {
    if ($("#trackingbarcode").val() == "") {
        $("#nsgridContainer").css('visibility','hidden');
        $("#serialNumber").css('visibility','hidden');                
        $("#serialGridContainer").css('visibility','hidden');               
        $("#submitDiv").css('visibility','hidden');
    } else if ($("#trackingbarcode").val().length > 6) {
        $("#nsgridContainer").css('visibility','visible');
        $("#serialNumber").css('visibility','visible');
        $("#serialGridContainer").css('visibility','visible');
        $("#submitDiv").css('visibility','visible');
        $("#serialbarcode").focus();
    }
}
function addSerial() {
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
        if ((serial.val().length > 6) && (bin.val().length > 4)) {
            addSerial();
        } else if (serial.val().length > 6) {
            bin.focus();
        } else if (bin.val().length > 4) {
            serial.focus();
        }
    }
}
function handleTrackingTab(event) {
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        changeTracking();
        event.preventDefault();
    }
}
function gotoSerial() {
    $("#serialbarcode").focus();
}

function getCompanyName() {
    return $("#company option:selected").text();
}

function getCompanyId() {
    return $("#company option:selected").val();
}

function changeCompany() {
    var company = getCompanyName();
    if (company.length > 3) {
        $("#trackingbarcodeDiv").css('visibility', 'visible');
        getNSItems(getCompanyId());
        $("#trackingbarcode").focus();
    }
}

function getCustomers() {
    body = { busObId:ReceivingObj,
                fields:[Rcv_CompanyName,Rcv_RecID],
                filters:[{fieldId:Rcv_Template,
                        operator:"eq",
                        value:"True"}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateCustomers)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function populateCustomers(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(customer, index) {
        var option = document.createElement("option");
        option.text = customer.fields[0].value;
        option.value = customer.fields[1].value;
        $('#company').append($('<option>', {
                            value: customer.fields[1].value,
                            text: customer.fields[0].value}))
    });
}

function getNSItems(TemplateRecID) {
    body = { busObId:ReceiveNSObj,
                fields:[RcvNS_Desc,RcvNS_ProductID],
                filters:[{fieldId: RcvNS_RcvID,
                        operator:"eq",
                        value:TemplateRecID}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateNSItems)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
            $("#nsgrid").jqxGrid('clear');
        }
    } catch (e) {
        alert(e);
    }
}

function populateNSItems(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(item, index) {
        $("#nsgrid").jqxGrid('addrow', null, {description: item.fields[0].value, good_count: 0, bad_count: 0, id: item.fields[1].value});
    });
}

/**
 * Function to delete a serial number row when the user clicks it.
 * @param {*} event
 */
function deleteSerial(event) {
    var serialNumber = $("#serialNumbers").jqxGrid('getcellvalue', event.args.rowindex, "serial");
    if (confirm("Delete serial number " + serialNumber + ". Are you sure?")) {
        var rowId = $("#serialNumbers").jqxGrid('getrowid', event.args.rowindex)
        $("#serialNumbers").jqxGrid('deleterow', rowId);
    }
}

function getSerialisedDescription(serial){
    body = { busObId:ConfigObj,
                fields:[Cfg_Model,Cfg_RecID,Cfg_Serial],
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
        rows = $("#serialNumbers").jqxGrid('getrows')
        rows.forEach(function(val, idx) {
            if (val.serial == serial) {
                $('#serialNumbers').jqxGrid('setcellvalue', idx, "description", model);
                $('#serialNumbers').jqxGrid('setcellvalue', idx, "recid", recId);
            }
        });
    }
}

function clearForm() {
    $("#trackingbarcode").val("");
    $("#serialNumbers").jqxGrid('clear');
    $("#nsgrid").jqxGrid('getrows').forEach(function(row, index) {
        $("#nsgrid").jqxGrid('setcellvalue', index, "good_count", 0);
        $("#nsgrid").jqxGrid('setcellvalue', index, "bad_count", 0);
    })
    changeTracking();
}

function submitForm() {
    var data = {receiving:{
                    tracking:$("#trackingbarcode").val(),
                    company:getCompanyName(),
                    nsproducts:[],
                    items:[]
    }};

    nsproducts = $("#nsgrid").jqxGrid('getrows');
    nsproducts.forEach(function(product, index){
        if ((product.good_count > 0) || (product.bad_count > 0)) {
            data.receiving.nsproducts.push({id:product.id,description:product.description,good:product.good_count,bad:product.bad_count})
        }
    });
    items = $("#serialNumbers").jqxGrid('getrows');
    items.forEach(function(item, index){
        data.receiving.items.push({serial:item.serial,bin:item.bin,model:item.description,recid:item.recid})
    })
    var body = {busObId:WebHookObj,
                fields:[
                    { dirty:true, fieldId: WH_Name, value: "Receiving" },
                    { dirty:true, fieldId: WH_Payload, value: JSON.stringify(data)}
                ]};
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

function saveComplete(data, status, xhr) {
    if (xhr.status == 200) {
        clearForm();
    } else {
        alert("Failed!\n" + xhr.responseText);
    }
}
