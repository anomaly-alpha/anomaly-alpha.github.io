' Launches node rich-presence.js hidden (window style 0) from the skarn-bot dir.
Set fso = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("Wscript.Shell")
botDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
ws.CurrentDirectory = botDir
ws.Run "node rich-presence.js", 0, False
