[WebMethod]
    public static string Info()
    {
        JavaScriptSerializer js = new JavaScriptSerializer();
        string result = js.Serialize(new string[] { "one", "two", "three" });
        return result;
    }