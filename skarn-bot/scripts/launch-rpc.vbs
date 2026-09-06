' Launches the independent skarn-rpc runtime hidden (window style 0).
Set fso = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("Wscript.Shell")
botDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
ws.CurrentDirectory = botDir
rpcDir = fso.BuildPath(botDir, "..\skarn-rpc")
ws.CurrentDirectory = rpcDir
ws.Run "node rich-presence.js", 0, False
