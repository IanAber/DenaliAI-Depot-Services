# DenaliReceiving
WEB based Depot services for Cherwell used by Denali.

Requires JQWidgets installation. JQWidgets should be in a jqwidgest folder in the root of the IIS Web Service.

Download this project and install it in a a folder somewhere on the IIS WEB server that supplies Cherwell. It was tested by installing to d:\Depot\web\...
Set up a virtual directory in IIS to point to this web folder. It was set up in test a Depot pointing to D:\Depot\web

The use should now be able to access the funtionality by browsing to http://servername/Depot where servername is the name of the Cherwell server.

