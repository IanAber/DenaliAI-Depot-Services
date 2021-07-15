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

var productSpec={
    serial:false,
    imei1:false,
    imei2:false,
    imei3:false,
    iccid:false
}

/**
 * Render the decrement cell based on the type of device
 * @param {number} row 
 * @returns 
 */
function renderDecrement(row) {
    if ($('#bins').jqxGrid('getrowdatabyid', row).detail.serial) {
        return '';
    } else {
        return 'Decrement'
    }
}

/**
 * Decrement the count for this device
 * @param {number} row 
 */
function decrementRow(row) {
    binSpec = $('#bins').jqxGrid('getrowdatabyid', row);
    if (!binSpec.detail.serial && (binSpec.qty > 0)) {
        binSpec.qty = binSpec.qty - 1;
        updateInventory($("#company option:selected").text(), binSpec.product, binSpec.detail.id,
            $("#depot option:selected").text(), -1, binSpec.bin, binSpec.detail.binId, binSpec.qty);
        $("#bins").jqxGrid('setcellvalue', row, 'qty', binSpec.qty);
    }
}

/**
 * When the document is loaded we need to initialise various controls.
 */
 $(document).ready(function () {
    var bins = 
    {
        localdata: data.bins,
        datatype: "array",
        updaterow: function (rowid, rowdata, commit) {
            commit(true);
        },
        datafields:
        [
                {name: 'bin', type: 'string' },      // bin number
                {name: 'product', type:'string' },   // product to be placed in the bin
                {name: 'detail', type:'string'},     // details about the product
                {name: 'qty', type:'string'}         // Number of items in the bin
        ]
    };

    var binAdapter = new $.jqx.dataAdapter(bins);

    // Initialise the bins grid
    $("#bins").jqxGrid(
    {
        width: "100%",
        source: binAdapter,
        theme: 'energyblue',
        editable: false,
        enabletooltips: false,
        selectionmode: 'singlerow',
        rowsheight: 28,
        autoheight: true,
        cellhover: function (element, pageX, pageY)
        {
//            var cell = $('#jqxgrid').jqxGrid('getcellatposition', pageX, pageY);
//            var row = cell.row;
//            var data = $('#jqxgrid').jqxGrid('getrowdata', row);
            // update tooltip.
            $("#bins").jqxTooltip({ content: "Right click row to adjust bin quantity." });
            // open tooltip.
            $("#bins").jqxTooltip('open', pageX + 15, pageY + 3);
        },
        columns: [
            { text: 'Bin Number', datafield: 'bin', editable: false, width: 300, font_size: "large" }, // Bin identifier
            { text: 'Product', datafield: 'product', editable: false},                  // Product to go in this bin
            { text: 'qty', datafield: 'qty', editable: false, width: 40},               // Number of items placed in the bin
            { text: '', datafield: 'Complete', columntype: 'button', width: 120, cellsrenderer: function () {
                return 'Complete';
             }, buttonclick: function (row) {
                 $("#bins").jqxGrid("deleterow", row);
             }
            },
            { text: '', datafield: 'Delete', columntype: 'button', width: 120, cellsrenderer: renderDecrement, 
                buttonclick: decrementRow},
            { text: 'productDetail', datafield: 'detail', editable: false, width: 0}
        ]
    });

    $("#bins").on('rowselect', binSelected);
    $("#bins").on("cellclick", setBinQuantity);
    $("#bins").jqxGrid('hidecolumn','detail');
    $("#scan").keydown(handleScanTab);
    loadToken();
    loadDepots();
    loadCompanies();
    loadStatus();
});

/**
 * Given a string of digits this function check to see if it is valid using the luhn algorithm.
 * @param {string} val 
 * @returns 
 */
function luhnValid(val) {
    idx = val.length - 1;
    bEven = true;
    digitSum = 0;
    while (idx--) {
        digit = parseInt(val.substr(idx,1));
        if (bEven) {
            digit *= 2;
            if (digit > 9){
                digit -= 9;
            }
        }
        bEven = !bEven;
        digitSum += digit;
    }
    digitSum *= 9;
    digitSum = digitSum % 10;
    return digitSum == parseInt(val.substr(idx,val.length - 1));
}

function isICCID(scanVal) {
    if ((scanVal.length == 19) && (luhnValid(scanVal))) {
        return true;
    } else {
        return false;
    }
}

function isIMEI(scanVal) {
    if ((scanVal.length == 15) && (luhnValid(scanVal))) {
        return true;
    } else {
        return false;
    }
}

function checkESIM(val) {
    let a = BigInt(val);
    let div = BigInt('97');
    let x = a - ((a / div) * div);
    return(x == 1);
}

function isESIM(scanVal) {
    if ((scanVal.length == 32) && (checkESIM(scanVal))) {
        return true;
    } else {
        return false;
    }
}

/**
 * Clear the given bin so it no longer contains any non serialised items.
 * @param {string} id 
 */
function clearBin(id) {
    payload = {
        busObId: BinObj,
        busObRecId : id,
        fields : [
            { dirty: true, fieldId: Bin_ProdID, value: "" },
            { dirty: true, fieldId: Bin_Qty, value: 0 },
        ],
        persist : true
    }
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(payload),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return true;
            } else {
                alert( "Cherwell clear the Bin: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
    return true;
}

/**
 * Set the content of the bin to the given product and quantity
 * @param {string} id 
 * @param {string} product 
 * @param {number} qty
 * @param {string} binBarcode 
 */
function setBinContent(id, product, qty, binBarcode) {
    payload = {
        busObId : BinObj,
        fields : [
            { dirty: true, fieldId: Bin_ProdID, value: product },
            { dirty: true, fieldId: Bin_Qty, value: qty},
            { dirty: true, fieldId: Bin_Bin, value: binBarcode}
        ],
        persist: true
    }
    if (id != "") {
        payload.busObRecId = id;
    }
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(payload),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return xhr.responseJSON.businessObjects[0].busObId;
            } else {
                alert( "Cherwell update Bin: " + xhr.status + "\n" + xhr.responseText);
                return "";
            }
        }
    } catch (e) {
        alert(e);
        return "";
    }
}


/**
 * 
 * @param {string} binNumber  - Scanned bin barcode
 */
function addBin(binNumber) {
    // Check to see if we have this bin already
    binSpec  = findBin(binNumber);
    
    if (binSpec.length == 0) {
        // If the firmware version is required but has not been specified stop here.
        if (getProductDetail().firmwareVersionRequired && ($('#firmwareVersion').val().length == 0)){
            alert('This product needs a firmware version number to be specified first.');
            $("#scan").val("");
            return;
        }
        // Bin not found so add it.
        qty = 0;
        binId = "";
        bin = findBinObjByBarcode(binNumber);
        if (bin !== undefined) {
            // Bin exists! What is in it?
            if ((bin.qty > 0) && (bin.product != getProductId())) {
                // This bin contains something else!
                if (!confirm("This bin is marked as containing something else. Do you wish to change it to " + getProductModel())) {
                    $('#scan').val("");
                    return;
                }
                clearBin(bin.id);
            } else {
                qty = bin.qty;
            }
            binId = bin.id;
        } else {
            // Create an empty bin
            binId = updateBinContent(getProductId(), undefined, 0, binNumber)
        }

        productDetail = getProductDetail();
        // Add in the firmware version if required for this product
        if (productDetail.firmwareVersionRequired) {
            productDetail.firmwareVersion = $('#firmwareVersion').val();
        }
        productDetail.binId = binId;
        $("#bins").jqxGrid('addrow', null, {bin: binNumber, product: getProductName(), detail: productDetail, qty: qty });
    } else {
        // Product is already set for this bin so ignore this
        if (binSpec[0].product != getProductName()) {
            // Bin found with different product assigned so does it contain any items yet ?
            if (binSpec[0].qty > 0) {
                alert ("You have started placing " + binSpec[0].product + 's in this bin. You cannot change to ' + getProductName);
            } else {
                // Bin is empty so replace the current bin with a new one for the indicated product.
                $("#bins").jqxGrid('deleterow', binSpec[0].boundIndex);
                $("#bins").jqxGrid('addrow', null, {bin: binNumber, product: getProductName(), detail: getProductDetail(), qty: 0 });
            }
        }
    }
    $("#scan").val("");
    $("#product").val("").change();
    $("#firmwareVersion").val("");
    $("#firmwareVersionDiv").css("visibility", "hidden");
}

/* Handle the tab or enter after scanning into the scan field */
function handleScanTab(event) {
    scan = $("#scan");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        txt = scan.val();
        // Need at least 3 characters
        if (txt.length < 3) {
            return;
        }

        // If we have a product selected then this should be a bin
        if (getProductId() != "") {
            addBin(txt);
            $("#scan").val("");
            return;
        }

        binSpec = findBin(txt);
        if (binSpec.length > 0)
        {
            $("#bins").jqxGrid('selectrow', binSpec[0].boundindex);
            $("#scan").val("");
            return;
        }

        if (txt.length > 6) {
            if (isICCID(txt)) {
                if ($('#serial').val() == "") {
                    $('#serial').val(txt);
                } else {
                    alert("You have already scanned the ICCID. To rescan please clear the field first.");
                }
            } else if (isIMEI(txt)) {
                if (($('#imei1').val() == "") && (productSpec.imei1)) {
                    $('#imei1').val(txt);
                } else if (($('#imei2').val() == "") && (productSpec.imei2)) {
                    $('#imei2').val(txt);
                } else if (($('#imei3').val() == "") && (productSpec.imei3)) {
                    $('#imei3').val(txt);
                } else {
                    alert("You have already scanned all imei fields. To rescan please clear the field to rescan first");
                }
            } else if (isESIM(txt)) {
                if (productSpec.esim) {
                    if ($('#eSIM').val() == "") {
                        $('#eSIM').val(txt);
                    } else {
                        alert("You have already scanned the e-SIM field. To rescan please clear the field to rescan first");
                    }
                }
            } else {
                // Make sure we are not expecting an ICCID as the serial number (SIM cards etc.)
                if (productSpec.iccid) {
                    alert("This does not appear to be a valid ICCID.");
                } else {
                    if ($('#serial').val() == "") {
                        $('#serial').val(txt);
                    } else {
                        alert("You have already scanned the serial number. To rescan please clear the field first.");
                    }
                }
            }
            if (($('#serial').val().length > 0) &&
                (($('#imei1').val().length > 0) || !productSpec.imei1) &&
                (($('#imei2').val().length > 0) || !productSpec.imei2) &&
                (($('#imei3').val().length > 0) || !productSpec.imei3) &&
                (($('#eSIM').val().length > 0) || !productSpec.esim)) {
                    var rowindex = $('#bins').jqxGrid('getselectedrowindex');

                    binSpec = $("#bins").jqxGrid('getrows');
                    saveBin(binSpec[rowindex]);            
            }
            $('#scan').val("");
        }
    }
}

/**
 * Moves the cursor to the scan field
 */
function gotoScan() {
    $("#scan").focus();
}

/**
 * Gets the name of the selected company
 * @returns string
 */
function getCompanyName() {
    return $("#company option:selected").text();
}

/**
 * Gets the ID of the selected company
 * @returns string
 */
function getCompanyId() {
    return $("#company option:selected").val();
}

/**
 * Loads the product drop list
 * @param {*} data 
 * @param {*} status 
 * @param {*} xhr 
 */
function populateProducts(data, status, xhr) {
    var records = data.businessObjects;
    spec = { id:"",
             type:"",
             serial:false,
             imei1:false,
             imei2:false,
             imei3:false,
             iccid:false,
             esim:false}

    $('#product').text("");
    $('#product').append($('<option>', {value:'', text:'Select a Product to add a bin'}));
    records.forEach(function(product, index) {
//        var option = document.createElement("option");
//        option.text = product.fields[0].value;
        spec.id = product.fields[1].value;
        spec.type = product.fields[2].value;
        spec.iccid = product.fields[2].value.toLowerCase() == "config - sim";
        spec.serial = product.fields[3].value.toLowerCase() == 'true';
        spec.imei1 = product.fields[4].value.toLowerCase() == 'true';
        spec.imei2 = product.fields[5].value.toLowerCase() == 'true';
        spec.imei3 = product.fields[6].value.toLowerCase() == 'true';
        spec.esim = product.fields[7].value.toLowerCase() == 'true';
        spec.firmwareVersionRequired = product.fields[8].value.toLowerCase() == 'true';
        spec.firmwareVersion = "";
        spec.model = product.fields[9].value;
        $('#product').append($('<option>', {
                            value: JSON.stringify(spec),
                            text: product.fields[0].value}))
    });
    $('#product').val("");
}

/**
 * Fetches the products for the given company
 * @param {string} companyId 
 */
function loadProducts(companyId) {
    body = { busObId:ProductObj,
        fields:[Prd_Name,Prd_RecID,Prd_AssetCategory,Prd_Serialised,Prd_HasIMEI1,Prd_HasIMEI2,Prd_HasIMEI3,Prd_HasESIM,Prd_FirmwareRqd,Prd_Model],
        filters:[{fieldId:Prd_CompanyRecID,
                operator:"eq",
                value:companyId}],
        sorting:[{
            fieldId:Prd_Name,
            sortDirection: "1"}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateProducts)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

/**
 * Gets the name of the current product
 * @returns string
 */
function getProductName() {
    return $("#product option:selected").text();
}

/**
 * Gets the details of the selected product
 * @returns object
 */
function getProductDetail() {
    det = $("#product option:selected").val();
    if (det != "") {
        return JSON.parse(det);
    } else {
        return undefined;
    }
}

/**
 * Gets the ID from the current product
 * @returns string
 */
function getProductId() {
    det = getProductDetail();
    if (typeof det == 'undefined') {
        return "";
    } else {
        return det.id;
    }
}

/**
 * Gets the model from the current product
 * @returns string
 */
function getProductModel() {
    det = getProductDetail();
    if (typeof det == 'undefined') {
        return "";
    } else {
        return det.model;
    }
}

/**
 * Called when a new product is selected from the drop list ready to be assigned to a new bin.
 */
function changeProduct() {
    $("#binScanDiv").css('visibility','visible');
    $("#scanDiv").css('visibility','visible');
    if (getProductId() != "") {
        $("#scanLabel").text("Scan Bin");
        $("#serialDiv").css("visibility","hidden");
        $("#imei1Div").css("visibility","hidden");
        $("#imei2Div").css("visibility","hidden");
        $("#imei3Div").css("visibility","hidden");
        $("#eSIMDiv").css("visibility","hidden");
        if (getProductDetail().firmwareVersionRequired) {
            $("#firmwareVersionDiv").css('visibility', 'visible');
        } else {
            $("#firmwareVersionDiv").css('visibility', 'hidden');
        }
    } else {
        $("#scanLabel").text("Scan Bin or Device");
    }
    $("#scan").focus();
}

/**
 * Called when a new company is selected
 */
function changeCompany() {
    var companyId = getCompanyId();
    var company = getCompanyName();
    if (companyId != "") {
        loadProducts(companyId);
    }
    $('#assetStatusDiv').css('visibility','visible');
}

/**
 * Load the available companies
 */
function loadCompanies() {
    body = { busObId:CompanyObj,
                fields:[CY_CompanyName,CY_RecID],
                filters:[{fieldId:CY_Status,
                        operator:"eq",
                        value:"Active"}],
                sorting:[{
                    fieldId:CY_CompanyName,
                    sortDirection: "1"}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateCompanies)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

/**
 * Populate the Companies drop list
 * @param {*} data 
 * @param {*} status 
 * @param {*} xhr 
 */
function populateCompanies(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(customer, index) {
        $('#company').append($('<option>', {
                            value: customer.fields[1].value,
                            text: customer.fields[0].value}))
    });
}

/**
 * Loads the available Depot values
 */
function loadDepots() {
    body = { busObId:DepotObj,
                fields:[DepotName, DepotRecId],
                sorting:[{
                    fieldId:DepotName,
                    sortDirection: "1"}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateDepots)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

/**
 * Populates the depot drop list
 * @param {*} data 
 * @param {*} status 
 * @param {*} xhr 
 */
function populateDepots(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(depot, index) {
        $('#depot').append($('<option>', {
                            value: depot.fields[1].value,
                            text: depot.fields[0].value}))
    });
    depotId = getCookie("depot");
    if (depotId.length == 42) {
        $('#depot').val(depotId).change();
    }
}

function changeDepot() {
    var depot = getDepotId();
    if (depot.length == 42) {
        setCookie("depot", depot, 14);
        $("#companyDiv").css('visibility', 'visible');
    }
}

/**
 * Fetches the available status values
 */
function loadStatus() {
    body = { busObId:StatusObj,
                fields:[ST_RecID, ST_Status],
                sorting:[{
                    fieldId:ST_Status,
                    sortDirection: "1"}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateStatus)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

/**
 * Populate the available status values
 * @param {*} data 
 * @param {*} status 
 * @param {*} xhr 
 */
function populateStatus(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(stat, index) {
        $('#assetStatus').append($('<option>', {
                            value: stat.fields[0].value,
                            text: stat.fields[1].value}))
    });
    $('#assetStatus').val("New");
}

/**
 * Called when the asset status is changed
 */
function changeStatus() {
    loadOpStatus();
    $("#opStatusDiv").css('visibility','visible');
}

/**
 * 
 * @returns Get the selected asset status text
 */
function statusText() {
    return $("#assetStatus option:selected").text();
}

/**
 * Fetches the operational status based on the selected asset status
 */
function loadOpStatus() {
    body = { busObId:OpStatusObj,
                fields:[OS_RecID, OS_OpStatus],
                filters:[{fieldId: OS_Status,
                         operator: 'eq',
                         value: statusText()}],
                sorting:[{
                    fieldId:OS_Status,
                    sortDirection: "1"}]
            };
    try {
        $("#opStatus").text("");

        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateOpStatus)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

/**
 * Fills the operational status with values based on the selected status
 * @param {*} data 
 * @param {*} status 
 * @param {*} xhr 
 */
function populateOpStatus(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(stat, index) {
        $('#opStatus').append($('<option>', {
                            value: stat.fields[0].value,
                            text: stat.fields[1].value}))
    });
    $('#opStatus').val("Stock");
}

/**
 * Called when the Operational Status field is changed
 */
function changeOpStatus() {
    $("#invoiceDiv").css('visibility','visible');
}

/**
 * Called when the invoice field is changed
 */
function changeInvoice() {
    if ($("#invoice").val().length > 5) {
        $("#productDiv").css('visibility','visible');
    }
}

/**
 * 
 * @param {*} bin 
 * @returns the bin if found
 */
function findBin(bin) {
    bins = $("#bins").jqxGrid("getrows");
    return bins.filter(obj => {return obj.bin === bin});
}

function saveDevice(payload) {
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(payload),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return true;
            } else {
                alert( "Cherwell update the CI Status: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
//    alert(JSON.stringify(payload));
    return true;
}

/**
 * Searches for an existing bin with the given bar code and returns a bin object if it is found
 * @param {string} binCode 
 * @returns 
 */
function findBinObjByBarcode(binCode) {
    body = { busObId:BinObj,
        fields:[Bin_RecID, Bin_ProdID, Bin_Qty],
        filters:[{fieldId:Bin_Bin,
                operator:"eq",
                value:binCode}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/getsearchresults",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                if (xhr.responseJSON.businessObjects.length > 0) {
                    return {id: xhr.responseJSON.businessObjects[0].fields[0].value,
                            product: xhr.responseJSON.businessObjects[0].fields[1].value,
                            qty: parseInt(xhr.responseJSON.businessObjects[0].fields[2].value, 10)};
                } else {
                    return undefined;
                }
            } else {
                alert( "Cherwell find by bin barcode failed: " + xhr.status + "\n" + xhr.responseText);
                return undefined;
            }
        }
    } catch (e) {
        alert(e);
        return undefined;
    }
}

function findCIBySerial(serial) {
    body = { busObId:ConfigObj,
        fields:[Cfg_RecID],
        filters:[{fieldId:Cfg_Serial,
                operator:"eq",
                value:serial}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/getsearchresults",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return (xhr.responseJSON.businessObjects.length > 0);
            } else {
                alert( "Cherwell find by serial number failed: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
}

/**
 * 
 * @param {string} company 
 * @param {string} product 
 * @param {string} depot 
 */
function getInventoryItem (company, product, depot) {
    body = { busObId:InventoryObj,
        fields:[INV_Quantity],
        filters:[{fieldId: INV_Customer, operator: "eq", value: company},
                 {fieldId: INV_Product, operator: "eq", value: product},
                 {fieldId: INV_Location, operator: "eq", value: depot}
                ]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/getsearchresults",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                if (xhr.responseJSON.businessObjects.length > 0) {
                    return { busObId: InventoryObj,
                             busObRecId: xhr.responseJSON.businessObjects[0].busObRecId,
                             fields: [                                
                                { dirty: false, fieldId: INV_Quantity, value: xhr.responseJSON.businessObjects[0].fields[0].value }
                             ],
                             persist : true
                          };
                }
            } else {
                alert( "Cherwell find inventory by part number failed: " + xhr.status + "\n" + xhr.responseText);
            }
        }
    } catch (e) {
        alert(e);
    }
    return undefined;
}

/**
 * Update the bin
 * @param {string} product 
 * @param {string} bin 
 * @param {number} qty 
 * @param {string} binBarcode
 */
function updateBinContent(product, bin, qty, binBarcode) {
    payload = {
        busObId : BinObj,
        fields : [
            { dirty: true, fieldId: Bin_ProdID, value: product },
            { dirty: true, fieldId: Bin_Qty, value: qty },
        ],
        persist : true
    }
    try {
        if (bin != undefined) {
            payload.busObRecId = bin;
        } else {
            payload.fields.push({dirty: true, fieldId: Bin_Bin, value: binBarcode});
        }
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(payload),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return xhr.responseJSON.busObRecId;
            } else {
                alert( "Cherwell update the Bin: " + xhr.status + "\n" + xhr.responseText);
                return undefined;
            }
        }
    } catch (e) {
        alert(e);
        return undefined;
    }
    return undefined;
}

/**
 * 
 * @param {string} company 
 * @param {string} product 
 * @param {string} depot 
 * @param {number} quantity
 * @param {string} binBarCode 
 * @param {string} bin
 * @param {number} binQty
 * @returns binRecID
 */
function updateInventory( company, product, productId, depot, quantity, binBarCode, bin, binQty) {
    item = getInventoryItem( company, product, depot);
    if (typeof item == 'undefined') {
        item = {
            busObId: InventoryObj,
            fields: [
                { dirty: true, fieldId: INV_Quantity, value: quantity },
                { dirty: true, fieldId: INV_Customer, value: company },
                { dirty: true, fieldId: INV_Product, value: product },
                { dirty: true, fieldId: INV_Location, value: depot }
            ],
            persist : true
        }
    } else {
        item.fields[0].value = parseInt(item.fields[0].value) + quantity;
        item.fields[0].dirty = true;
    }
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(item),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                binID = updateBinContent(productId, bin, binQty, binBarCode);
                if (binID !== undefined) {

                    return true;
                }
                return false;
            } else {
                alert( "Cherwell update inventory: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
    return false;
}

/**
 * 
 * @param {object} binSpec : {bin int, product string, detail obj, qty int }
 */
function saveBin(binSpec) {
    switch (binSpec.detail.type.toLowerCase()) {
        case "config - Computer" : cfgid = Cfg__Computer;
            break;
        case "config - mobile device" : cfgid = Cfg__MobileDevice;
            break;
        case "config - network device" : cfgid = Cfg__NetworkDevice;
            break;
        case "config - other ci" : cfgid = Cfg__OtherCI;
            break;
        case "config - printer" : cfgid = Cfg__Printer;
            break;
        case "config - server" : cfgid = Cfg__Server;
            break;
        case "config - sim" : cfgid = Cfg__SIM;
            break;
        case "config - software license" : cfgid = Cfg__SoftwareLicense;
            break;
        case "config - system" : cfgid = Cfg__System;
            break;
        case "config - telephony equipmnet" : cfgid = Cfg__TelephonyEquipment;
            break;
    }

    // Set up the payload for common fields for a serialised product
    configPayload = {
        busObId : cfgid,
        fields : [
//            { dirty: true, fieldId: Cfg_Model, value: binSpec.detail.model },
            { dirty: true, fieldId: Cfg_ProductRecID, value: binSpec.detail.id },
            { dirty: true, fieldId: Cfg_Serial, value: $("#serial").val() },
            { dirty: true, fieldId: Cfg_Bin, value: binSpec.bin },
            { dirty: true, fieldId: Cfg_Status, value: $("#assetStatus option:selected").text() },
            { dirty: true, fieldId: Cfg_OpStatus, value: $("#opStatus option:selected").text() },
            { dirty: true, fieldId: Cfg_Depot, value: $("#depot option:selected").text() },
            { dirty: true, fieldId: Cfg_Company, value: $("#company option:selected").text() },
            { dirty: true, fieldId: Cfg_CompanyId, value: $("#company option:selected").val() },
            { dirty: ($("#invoice").val().length != 0), fieldId: Cfg_Invoice, value: $("#invoice").val() },
            { dirty: ($("#serial").val().length != 0), fieldId: Cfg_Serial, value: $("#serial").val() }
        ],
        persist : true
    }

    // If this is serialised we need to set some additional fields based on the type of device
    if (binSpec.detail.serial) {
        if (findCIBySerial($("#serial").val())) {
            alert("An item with that serial number already exists.")
            return;
        }
        if (binSpec.detail.imei1) {
            configPayload.fields.push({dirty: true, fieldId: Cfg_Imei1, value: $("#imei1").val()});        
        }
        if (binSpec.detail.imei2) {
            configPayload.fields.push({dirty: true, fieldId: Cfg_Imei2, value: $("#imei2").val()});        
        }
        if (binSpec.detail.imei3) {
            configPayload.fields.push({dirty: true, fieldId: Cfg_Imei3, value: $("#imei3").val()});        
        }
        if (binSpec.detail.esim) {
            configPayload.fields.push({dirty: true, fieldId: Cfg_ESIM, value: $("#eSIM").val()});
        }
        if (binSpec.detail.firmwareVersionRequired) {
            // Get the firmware version, if required, from the form field. This way the user could override it if needed.
            configPayload.fields.push({dirty: true, fieldId: Cfg_FirmwareVers, value: $("#firmwareVersion").val()})
        }
        // Do the save and if successful clear the fields ready for the next one.
        if (saveDevice(configPayload)) {
            // Increment the quantity for this bin in the grid
            qty = $("#bins").jqxGrid('getCellvalue', binSpec.boundindex, 'qty') + 1;
            $("#bins").jqxGrid('setcellvalue', binSpec.boundindex, 'qty', qty);
            // Clear the device specific fields
            $("#serial").val("");
            $("#imei1").val("");
            $("#imei2").val("");
            $("#imei3").val("");
            $("#eSIM").val("");
            // Display confirmation for 1.5 seconds
            $("#confirmation").css("visibility", "visible");
            setTimeout(function(){ $("#confirmation").css("visibility", "hidden"); }, 1500);
        }
    } else {
        // Increment the count for the particular inventory item
        if (updateInventory($("#company option:selected").text(), binSpec.product, binSpec.detail.id,
                                     $("#depot option:selected").text(), 1, binSpec.bin, binSpec.detail.binId, binSpec.qty)) {
            // Display confirmation for 1.5 seconds
            $("#confirmation").css("visibility", "visible");
            setTimeout(function(){ $("#confirmation").css("visibility", "hidden"); }, 1500);
        }
    }
}

/**
 * Function to override the bin quantity when the field is right clicked.
 * @param {object} event 
 */
function setBinQuantity (event) 
{
    if (event.args.rightclick) {

        qty = prompt("Enter the new quantity", event.args.row.bounddata.qty);
        if (qty != null) {
            qty = parseInt(qty, 10);
            data = event.args.row.bounddata;
            updateBinContent(data.detail.id, data.detail.binId, qty, data.bin);
            $("#bins").jqxGrid('setcellvalue', event.args.row.boundindex, 'qty', qty);
        }
    }
}

function binSelected(event) {
        scanRequired = false;
        productSpec.imei1 = false,
        productSpec.imei2 = false,
        productSpec.imei3 = false,
        productSpec.iccid = false;
        productSpec.esim = false;
        productSpec.firmwareVersionRequired = false;
        productSpec.firmwareVersion = "";
        $("#serial").val("");
        $("#imei1").val("");
        $("#imei2").val("");
        $("#imei3").val("");
        $("#eSIM").val("");

        // Set up the fields for the selected product
        binSpec = event.args.row;
        if (binSpec.detail.serial)
        {
            $('#serialDiv').css('visibility','visible');
            $('#serialDiv').css('display','block');
            scanRequired = true;
        } else {
            $('#serialDiv').css('visibility','hidden');
            $('#serialDiv').css('display','none');
        }
        if (binSpec.detail.imei1)
        {
            $('#imei1Div').css('visibility','visible');
            $('#imei1Div').css('display','block');
            scanRequired = true;
            productSpec.imei1 = true;
        } else {
            $('#imei1Div').css('visibility','hidden');    
            $('#imei1Div').css('display','none');
        }
        if (binSpec.detail.imei2)
        {
            $('#imei2Div').css('visibility','visible');
            $('#imei2Div').css('display','block');
            scanRequired = true;
            productSpec.imei2 = true;
        } else {
            $('#imei2Div').css('visibility','hidden');
            $('#imei2Div').css('display','none');
        }
        if (binSpec.detail.imei3)
        {
            $('#imei3Div').css('visibility','visible');
            $('#imei3Div').css('display','block');
            scanRequired = true;
            productSpec.imei3 = true;
        } else {
            $('#imei3Div').css('visibility','hidden');
            $('#imei3Div').css('display','none');
        }
        if (binSpec.detail.esim)
        {
            $('#eSIMDiv').css('visibility','visible');
            $('#eSIMDiv').css('display','block');
            scanRequired = true;
            productSpec.esim = true;
        } else {
            $('#eSIMDiv').css('visibility','hidden');
            $('#eSIMDiv').css('display','none');
        }
        if (binSpec.detail.iccid)
        {
            $('#serialLabel').text("ICCID");
            productSpec.iccid = true;
        } else {
            $('#serialLabel').text("Serial #");
        }
        if (binSpec.detail.firmwareVersionRequired)
        {
            $('#firmwareVersion').val(binSpec.detail.firmwareVersion);
            $('#firmwareVersionDiv').css('visibility', 'visible');
        } else {
            $('#firmwareVersion').val("");
            $('#firmwareVersionDiv').css('visibility', 'hidden');
        }
        if (scanRequired) {
            $('#scanDiv').css('visibility','visible');
            $('#scan').focus();
        } else if($("#scan").val() != "") {
            qty = binSpec.qty + 1;
            $("#bins").jqxGrid('setcellvalue', binSpec.boundindex, 'qty', qty);
            binSpec.binId = saveBin(binSpec);
        }
        // Clear the scan and product selection fields
        $("#scan").val("");
        $("#product").val("").change();
}

