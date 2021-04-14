<%@ page language="VB" %>
<%
dim csv = request("csv")
dim lines
dim headings

if(instr(request("csv"), vbCRLF) > 0) then
	lines = split(mid(csv,2,len(csv)-2), """"+vbCRLF+"""")
else
	lines = split(mid(csv,2,len(csv)-2), """"+vbLF+"""")
end if
if(UBound(lines) > 0) then
	headings = split(lines(0),""",""")
	dim h = 0
	response.write("{""formData"":[")
	for each heading in headings
		response.write("{""h"":""")
		response.write(heading)
		response.write(""",""v"":[""")
		for nRow = 1 to UBound(lines)
			dim fields = split(lines(nRow),""",""")
			response.write(replace(fields(h), """""", """ """))
			if(nRow < UBound(lines)) then
				response.write(""",""")
			end if
		next
		response.write("""]}")
		if(h < UBound(headings)) then
			response.write(",")
		end if
		response.write(vbCRLF)
		h = h + 1
	next
	response.write("]}")
else
	response.write("Failed to find multiple lines" + vbCRLF)
	for i = 1 to len(request("csv"))
		response.write(hex(asc(mid(request("csv"), i, 1))) + " ")
		if (i mod 20) = 0 then
			response.write(vbCRLF)
		end if
	next
end if
%>