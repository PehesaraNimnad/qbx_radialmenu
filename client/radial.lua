-- Radial engine + custom NUI for qbx_radialmenu.
-- Same behaviour as ox_lib's radial (items, sub menus, onSelect, keepOpen, refresh), drawn by web/.
-- Inside this resource lib.*Radial* points here, so the rest of the scripts stay unchanged.
-- Other resources can use the same API through exports.qbx_radialmenu:addRadialItem(...) etc.

local config = require 'config.client'
local ui = config.radial or {}

---@class RadialItem
---@field id? string
---@field icon string|table
---@field label string
---@field menu? string
---@field onSelect? function|string
---@field keepOpen? boolean
---@field resource? string

local isOpen = false
local isDisabled = false
local menus = {} ---@type table<string, { id: string, items: RadialItem[], resource?: string }>
local menuItems = {} ---@type RadialItem[]
local menuHistory = {} ---@type { id?: string, option: string, title?: string }[]
local currentRadial
local rootRadial
local titles = {} ---@type table<string, string> menu id -> label of the item that opens it

local function caller()
    return GetInvokingResource() or cache.resource
end

---Plain data for the NUI (functions never cross)
local function uiItems(items)
    local out = {}
    for i = 1, #items do
        local item = items[i]
        out[i] = {
            label = item.label,
            icon = item.icon,
            iconWidth = item.iconWidth,
            iconHeight = item.iconHeight,
            menu = type(item.menu) == 'string' and item.menu or nil, -- id only, used to re-highlight on "back"
            keepOpen = item.keepOpen == true,
        }
        if item.menu and item.label then titles[item.menu] = item.label end
    end
    return out
end

local function send(data)
    SendNUIMessage({ action = 'radial', data = data })
end

local function showRadial(id, option)
    local radial = id and menus[id]
    if id and not radial then
        return error(('No radial menu with id "%s" found.'):format(id))
    end

    currentRadial = radial
    send(false) -- let the ring animate out before the next one
    Wait(110)
    if not isOpen then return end

    local items = radial and radial.items or menuItems
    send({
        items = uiItems(items),
        sub = (radial and radial ~= rootRadial) or nil,
        option = option,
        title = radial and titles[radial.id] or nil,
    })
end

local function refreshRadial(menuId)
    if not isOpen then return end

    if currentRadial and menuId then
        if menuId == currentRadial.id then
            return showRadial(menuId)
        end
        for i = 1, #menuHistory do
            local sub = menuHistory[i]
            if sub.id == menuId then
                local parent = menus[sub.id]
                for j = 1, #parent.items do
                    if parent.items[j].menu == currentRadial.id then return end
                end
                currentRadial = parent
                for j = #menuHistory, i, -1 do menuHistory[j] = nil end
                return showRadial(currentRadial.id)
            end
        end
        return
    end

    table.wipe(menuHistory)
    showRadial()
end

local function setFocus(state)
    SetNuiFocus(state, state)
    -- like ox_lib: you can keep walking while the ring is open
    SetNuiFocusKeepInput(state)
end

local function hideRadial()
    if not isOpen then return end
    send(false)
    setFocus(false)
    table.wipe(menuHistory)
    isOpen = false
    currentRadial = nil
    rootRadial = nil
end

local function onRadialOpen(id)
    local radial = id and menus[id]
    if isDisabled or (id and not radial) then return end

    if isOpen then
        if rootRadial == radial then return hideRadial() end
        rootRadial = radial
        table.wipe(menuHistory)
        return showRadial(id)
    end

    local items = radial and radial.items or menuItems
    if #items == 0 or IsNuiFocused() or IsPauseMenuActive() then return end

    isOpen = true
    rootRadial = radial
    table.wipe(menuHistory)
    setFocus(true)
    SetCursorLocation(0.5, 0.5)
    showRadial(id)

    while isOpen do
        DisablePlayerFiring(cache.playerId, true)
        DisableControlAction(0, 1, true) -- look
        DisableControlAction(0, 2, true)
        DisableControlAction(0, 24, true) -- attack
        DisableControlAction(0, 25, true) -- aim
        DisableControlAction(0, 142, true)
        DisableControlAction(0, 106, true) -- vehicle mouse control
        DisableControlAction(2, 199, true) -- pause
        DisableControlAction(2, 200, true)
        Wait(0)
    end
end

---------------------------------------------------------------------------------------------------
-- API (same names as ox_lib)
---------------------------------------------------------------------------------------------------

local function registerRadial(radial)
    if type(radial) ~= 'table' or type(radial.id) ~= 'string' or type(radial.items) ~= 'table' then
        return error('registerRadial expects { id = string, items = table }')
    end
    radial.resource = caller()
    menus[radial.id] = radial
    if currentRadial then refreshRadial(radial.id) end
end

local function addRadialItem(items, parentMenuId)
    local target
    if parentMenuId then
        if not menus[parentMenuId] then return error('No radial sub menu with that parent id found.') end
        target = menus[parentMenuId].items
    else
        target = menuItems
    end

    local resource = caller()
    items = table.type(items) == 'array' and items or { items }

    for i = 1, #items do
        local item = items[i]
        item.resource = resource
        local replaced = false
        if item.id then
            for j = 1, #target do
                if target[j].id == item.id then
                    target[j] = item
                    replaced = true
                    break
                end
            end
        end
        if not replaced then target[#target + 1] = item end
    end

    if isOpen and not currentRadial then refreshRadial() end
end

local function removeRadialItem(id, parentMenuId)
    local target
    if parentMenuId then
        if not menus[parentMenuId] then return error('No radial sub menu with that parent id found.') end
        target = menus[parentMenuId].items
    else
        target = menuItems
    end
    for i = 1, #target do
        if target[i].id == id then
            table.remove(target, i)
            break
        end
    end
    if isOpen then refreshRadial() end
end

local function clearRadialItems()
    table.wipe(menuItems)
    if isOpen then refreshRadial() end
end

local function disableRadial(state)
    isDisabled = state == true
    if isOpen and isDisabled then hideRadial() end
end

local function getCurrentRadialId()
    return currentRadial and currentRadial.id
end

-- this resource keeps calling lib.* — point it at our engine
lib.registerRadial = registerRadial
lib.addRadialItem = addRadialItem
lib.removeRadialItem = removeRadialItem
lib.clearRadialItems = clearRadialItems
lib.hideRadial = hideRadial
lib.disableRadial = disableRadial
lib.showRadialMenu = onRadialOpen
lib.getCurrentRadialId = getCurrentRadialId

-- other resources: exports.qbx_radialmenu:addRadialItem(...) (drop-in for lib.addRadialItem)
exports('registerRadial', registerRadial)
exports('addRadialItem', addRadialItem)
exports('removeRadialItem', removeRadialItem)
exports('clearRadialItems', clearRadialItems)
exports('hideRadial', hideRadial)
exports('disableRadial', disableRadial)
exports('showRadialMenu', onRadialOpen)
exports('getCurrentRadialId', getCurrentRadialId)
exports('isOpen', function() return isOpen end)

---------------------------------------------------------------------------------------------------
-- NUI callbacks
---------------------------------------------------------------------------------------------------

RegisterNUICallback('ready', function(_, cb)
    cb({
        perPage = math.max(4, math.min(10, tonumber(ui.perPage) or 8)),
        scale = math.max(0.7, math.min(1.4, tonumber(ui.scale) or 1.0)),
        sounds = ui.sounds ~= false,
        accent = type(ui.accent) == 'string' and ui.accent:match('^#%x%x%x%x%x%x$') and ui.accent or '#f4f4f5',
        hints = ui.showHints ~= false,
        hold = ui.holdToOpen == true,
        key = ui.key or 'Z',
    })
end)

RegisterNUICallback('select', function(data, cb)
    cb(1)
    if not isOpen or type(data) ~= 'table' then return end
    local itemIndex = math.tointeger(data.index)
    if not itemIndex then return end
    itemIndex += 1

    local item, currentMenu
    if currentRadial then
        item = currentRadial.items[itemIndex]
        currentMenu = currentRadial.id
    else
        item = menuItems[itemIndex]
    end
    if not item then return end

    local menuResource = currentRadial and currentRadial.resource or item.resource

    if item.menu then
        menuHistory[#menuHistory + 1] = { id = currentRadial and currentRadial.id, option = item.menu }
        showRadial(item.menu)
    elseif not item.keepOpen then
        hideRadial()
    end

    local onSelect = item.onSelect
    if onSelect then
        if type(onSelect) == 'string' then
            return exports[menuResource][onSelect](0, currentMenu, itemIndex)
        end
        onSelect(currentMenu, itemIndex)
    end
end)

RegisterNUICallback('back', function(_, cb)
    cb(1)
    if not isOpen then return end
    local n = #menuHistory
    local last = n > 0 and menuHistory[n]
    if not last then return hideRadial() end
    menuHistory[n] = nil

    if last.id then return showRadial(last.id, last.option) end

    currentRadial = nil
    send(false)
    Wait(110)
    if not isOpen then return end
    send({ items = uiItems(menuItems), option = last.option })
end)

RegisterNUICallback('close', function(_, cb)
    cb(1)
    hideRadial()
end)

---------------------------------------------------------------------------------------------------
-- Key, ox_lib radial off, cleanup
---------------------------------------------------------------------------------------------------

lib.addKeybind({
    name = 'qbx_radialmenu',
    description = locale('general.open_radial') ~= 'general.open_radial' and locale('general.open_radial') or 'Open radial menu',
    defaultKey = ui.key or 'Z',
    onPressed = function() onRadialOpen() end,
    onReleased = function()
        if ui.holdToOpen and isOpen and not currentRadial then SendNUIMessage({ action = 'release' }) end
    end,
})

-- only one radial at a time: switch ox_lib's off while this one runs (back on when we stop)
CreateThread(function()
    if GetResourceState('ox_lib') == 'started' then exports.ox_lib:disableRadial(true) end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == cache.resource then
        if isOpen then setFocus(false) end
        if GetResourceState('ox_lib') == 'started' then exports.ox_lib:disableRadial(false) end
        return
    end
    for i = #menuItems, 1, -1 do
        if menuItems[i].resource == resource then table.remove(menuItems, i) end
    end
    for id, menu in pairs(menus) do
        if menu.resource == resource then menus[id] = nil end
    end
end)
