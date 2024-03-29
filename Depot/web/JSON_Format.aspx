<%@ Page Language="C#" %>
<%@ Import Namespace="System.IO"%>
<%@ Import Namespace="System.Web.Script.Serialization"%>

<script runat="server">
	class JSON_PrettyPrinter{
		public static string Process(string inputText)
		{
			bool escaped = false;
			bool inquotes = false;
			int column = 0;
			int indentation = 0;
			Stack<int> indentations = new Stack<int>();
			int TABBING = 4;
			StringBuilder sb = new StringBuilder();
			foreach (char x in inputText)
			{
				sb.Append(x);
				column++;
				if (escaped)
				{
					escaped = false;
				}
				else
				{
					if (x == '\\')
					{
						escaped = true;
					}
					else if (x == '\"')
					{
						inquotes = !inquotes;
					}
					else if ( !inquotes)
					{
						if (x == ',')
						{
							// if we see a comma, go to next line, and indent to the same depth
							sb.Append("\r\n");
							column = 0;
							for (int i = 0; i < indentation; i++)
							{
								sb.Append(" ");
								column++;
							}
						} else if (x == '[' || x== '{') {
							// if we open a bracket or brace, indent further (push on stack)
							indentations.Push(indentation);
							indentation = column;
						}
						else if (x == ']' || x == '}')
						{
							// if we close a bracket or brace, undo one level of indent (pop)
							indentation = indentations.Pop();
						}
						else if (x == ':')
						{
							// if we see a colon, add spaces until we get to the next
							// tab stop, but without using tab characters!
							while ((column % TABBING) != 0)
							{
								sb.Append(' ');
								column++;
							}
						}
					}
				}
			}
			return sb.ToString();
		}
	}

	protected void Page_Load(object Sender, EventArgs e) {
		string strJson;
		using(var reader = new StreamReader(Request.InputStream)){
			strJson = reader.ReadToEnd();
		}
		Response.Write(JSON_PrettyPrinter.Process(strJson));
	}
</script>
