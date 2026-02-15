-- mGBA bridge for the TypeScript harness.
-- Reference: https://mgba.io/docs/scripting.html

local HOST = "127.0.0.1"
local PORT = 61337
local MAX_CHUNK_BYTES = 65536

local server = nil
local client = nil
local receiveBuffer = ""
local heldKeys = 0
local pendingAdvance = nil

local function log(msg)
  console:log("[gba_harness] " .. msg)
end

local function logError(msg)
  console:error("[gba_harness] " .. msg)
end

local function sendResponse(status, message)
  if client == nil then
    return
  end

  local payload = status
  if message ~= nil then
    payload = payload .. "\t" .. tostring(message)
  end

  local ok, err = client:send(payload .. "\n")
  if ok == nil then
    logError("Socket send failed: " .. tostring(err))
    client = nil
    receiveBuffer = ""
    pendingAdvance = nil
    emu:setKeys(heldKeys)
  end
end

local function sendOk(message)
  sendResponse("OK", message)
end

local function sendErr(message)
  sendResponse("ERR", message)
end

local function parseUIntArg(raw, label)
  if raw == nil or raw == "" then
    return nil, label .. " is required"
  end

  local value = tonumber(raw)
  if value == nil then
    return nil, label .. " must be numeric"
  end

  value = math.floor(value)
  if value < 0 then
    return nil, label .. " must be >= 0"
  end

  return value, nil
end

local function splitTabs(line)
  local fields = {}
  local startIndex = 1

  while true do
    local tabIndex = string.find(line, "\t", startIndex, true)
    if tabIndex == nil then
      table.insert(fields, string.sub(line, startIndex))
      break
    end

    table.insert(fields, string.sub(line, startIndex, tabIndex - 1))
    startIndex = tabIndex + 1
  end

  return fields
end

local function popLine()
  local lineEnd = string.find(receiveBuffer, "\n", 1, true)
  if lineEnd == nil then
    return nil
  end

  local line = string.sub(receiveBuffer, 1, lineEnd - 1)
  receiveBuffer = string.sub(receiveBuffer, lineEnd + 1)

  if string.sub(line, -1) == "\r" then
    line = string.sub(line, 1, -2)
  end

  return line
end

local function closeClient(reason)
  if client ~= nil then
    log("Client disconnected (" .. reason .. ")")
  end
  client = nil
  receiveBuffer = ""
  pendingAdvance = nil
  emu:setKeys(heldKeys)
end

local function handleCommand(line)
  local fields = splitTabs(line)
  local command = string.upper(fields[1] or "")

  if command == "" then
    sendErr("empty command")
    return false
  end

  if command == "QUIT" then
    sendOk("BYE")
    closeClient("client requested quit")
    return false
  end

  if command == "PING" then
    sendOk("PONG")
    return false
  end

  if command == "FRAME" then
    sendOk(tostring(emu:currentFrame()))
    return false
  end

  if command == "SET_KEYS" then
    local mask, err = parseUIntArg(fields[2], "SET_KEYS mask")
    if mask == nil then
      sendErr(err)
      return false
    end

    heldKeys = mask
    emu:setKeys(heldKeys)
    sendOk(tostring(heldKeys))
    return false
  end

  if command == "PRESS" then
    local mask, err = parseUIntArg(fields[2], "PRESS mask")
    if mask == nil then
      sendErr(err)
      return false
    end

    heldKeys = heldKeys | mask
    emu:setKeys(heldKeys)
    sendOk(tostring(heldKeys))
    return false
  end

  if command == "RELEASE" then
    local mask, err = parseUIntArg(fields[2], "RELEASE mask")
    if mask == nil then
      sendErr(err)
      return false
    end

    heldKeys = heldKeys & (~mask)
    emu:setKeys(heldKeys)
    sendOk(tostring(heldKeys))
    return false
  end

  if command == "CLEAR_KEYS" then
    heldKeys = 0
    emu:setKeys(0)
    sendOk("0")
    return false
  end

  if command == "ADVANCE" then
    local frameCount, frameErr = parseUIntArg(fields[2], "ADVANCE frames")
    if frameCount == nil then
      sendErr(frameErr)
      return false
    end
    if frameCount < 1 then
      sendErr("ADVANCE frames must be >= 1")
      return false
    end

    local tempMask = heldKeys
    if fields[3] ~= nil and fields[3] ~= "" then
      local parsedMask, maskErr = parseUIntArg(fields[3], "ADVANCE mask")
      if parsedMask == nil then
        sendErr(maskErr)
        return false
      end
      tempMask = parsedMask
    end

    pendingAdvance = {
      remaining = frameCount,
      mask = tempMask
    }
    return true
  end

  if command == "READ8" then
    local address, err = parseUIntArg(fields[2], "READ8 address")
    if address == nil then
      sendErr(err)
      return false
    end
    sendOk(tostring(emu:read8(address)))
    return false
  end

  if command == "READ16" then
    local address, err = parseUIntArg(fields[2], "READ16 address")
    if address == nil then
      sendErr(err)
      return false
    end
    sendOk(tostring(emu:read16(address)))
    return false
  end

  if command == "READ32" then
    local address, err = parseUIntArg(fields[2], "READ32 address")
    if address == nil then
      sendErr(err)
      return false
    end
    sendOk(tostring(emu:read32(address)))
    return false
  end

  if command == "WRITE8" then
    local address, addressErr = parseUIntArg(fields[2], "WRITE8 address")
    local value, valueErr = parseUIntArg(fields[3], "WRITE8 value")
    if address == nil then
      sendErr(addressErr)
      return false
    end
    if value == nil then
      sendErr(valueErr)
      return false
    end

    emu:write8(address, value)
    sendOk(nil)
    return false
  end

  if command == "WRITE16" then
    local address, addressErr = parseUIntArg(fields[2], "WRITE16 address")
    local value, valueErr = parseUIntArg(fields[3], "WRITE16 value")
    if address == nil then
      sendErr(addressErr)
      return false
    end
    if value == nil then
      sendErr(valueErr)
      return false
    end

    emu:write16(address, value)
    sendOk(nil)
    return false
  end

  if command == "WRITE32" then
    local address, addressErr = parseUIntArg(fields[2], "WRITE32 address")
    local value, valueErr = parseUIntArg(fields[3], "WRITE32 value")
    if address == nil then
      sendErr(addressErr)
      return false
    end
    if value == nil then
      sendErr(valueErr)
      return false
    end

    emu:write32(address, value)
    sendOk(nil)
    return false
  end

  if command == "SCREENSHOT" then
    local targetPath = fields[2]
    if targetPath == nil or targetPath == "" then
      sendErr("SCREENSHOT path is required")
      return false
    end

    log("SCREENSHOT begin: " .. targetPath)
    local screenshotOk, screenshotErr = pcall(function()
      emu:screenshot(targetPath)
    end)
    if not screenshotOk then
      sendErr("SCREENSHOT error: " .. tostring(screenshotErr))
      return false
    end

    log("SCREENSHOT done")
    sendOk(nil)
    return false
  end

  if command == "SAVE_STATE" then
    local targetPath = fields[2]
    if targetPath == nil or targetPath == "" then
      sendErr("SAVE_STATE path is required")
      return false
    end

    log("SAVE_STATE begin: " .. targetPath)
    local saveOk, saveResult = pcall(function()
      return emu:saveStateFile(targetPath, C.SAVESTATE.ALL)
    end)
    if not saveOk then
      sendErr("SAVE_STATE error: " .. tostring(saveResult))
      return false
    end
    if not saveResult then
      sendErr("SAVE_STATE failed")
      return false
    end

    log("SAVE_STATE done")
    sendOk(nil)
    return false
  end

  if command == "LOAD_STATE" then
    local targetPath = fields[2]
    if targetPath == nil or targetPath == "" then
      sendErr("LOAD_STATE path is required")
      return false
    end

    log("LOAD_STATE begin: " .. targetPath)
    local loadOk, loadResult = pcall(function()
      return emu:loadStateFile(targetPath, C.SAVESTATE.ALL)
    end)
    if not loadOk then
      sendErr("LOAD_STATE error: " .. tostring(loadResult))
      return false
    end
    if not loadResult then
      sendErr("LOAD_STATE failed")
      return false
    end

    log("LOAD_STATE done")
    sendOk(nil)
    return false
  end

  if command == "RESET" then
    emu:reset()
    sendOk(nil)
    return false
  end

  sendErr("unknown command: " .. command)
  return false
end

local function maybeAcceptClient()
  if client ~= nil then
    return
  end

  if not server:hasdata() then
    return
  end

  local accepted, err = server:accept()
  if accepted == nil then
    if err ~= C.SOCKERR.NO_DATA then
      logError("Accept failed: " .. tostring(err))
    end
    return
  end

  client = accepted
  receiveBuffer = ""
  pendingAdvance = nil
  log("Client connected")
end

local function pollClient()
  if client == nil then
    return
  end

  local chunkReads = 0
  while client:hasdata() do
    chunkReads = chunkReads + 1
    if chunkReads > 64 then
      break
    end

    local chunk, err = client:receive(MAX_CHUNK_BYTES)
    if chunk == nil then
      closeClient("receive failed: " .. tostring(err))
      return
    end

    receiveBuffer = receiveBuffer .. chunk
  end

  while true do
    local line = popLine()
    if line == nil then
      break
    end
    if line ~= "" then
      local startedAdvance = handleCommand(line)
      if startedAdvance then
        break
      end
    end
  end
end

local function onFrame()
  maybeAcceptClient()

  if pendingAdvance ~= nil then
    emu:setKeys(pendingAdvance.mask)
    pendingAdvance.remaining = pendingAdvance.remaining - 1

    if pendingAdvance.remaining <= 0 then
      pendingAdvance = nil
      emu:setKeys(heldKeys)
      sendOk(tostring(emu:currentFrame()))
    end
    return
  end

  emu:setKeys(heldKeys)
  pollClient()
end

local function startServer()
  local bindError = nil
  server, bindError = socket.bind(HOST, PORT)
  if server == nil then
    logError("Bind failed: " .. tostring(bindError))
    return false
  end

  local ok, listenError = server:listen(1)
  if listenError ~= nil then
    logError("Listen failed: " .. tostring(listenError))
    return false
  end

  log("Listening on " .. HOST .. ":" .. tostring(PORT))
  return true
end

if startServer() then
  callbacks:add("frame", onFrame)
  log("Bridge active. Run the TypeScript harness to connect.")
end
