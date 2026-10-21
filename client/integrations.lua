-- Radial entries for other resources, added without editing them

local config = require 'config.client'
local integrations = config.integrations or {}

local function started(resource)
    return GetResourceState(resource) == 'started'
end

---Called by setupRadialMenu (client/main.lua) every time the menu is rebuilt
function SetupIntegrations()
    if integrations.emotes and started('scully_emotemenu') then
        lib.registerRadial({
            id = 'integrationEmotesMenu',
            items = {
                {
                    id = 'emotes-open',
                    label = 'Emote menu',
                    icon = 'list',
                    onSelect = function() ExecuteCommand('emotemenu') end,
                },
                {
                    id = 'emotes-cancel',
                    label = 'Cancel emote',
                    icon = 'ban',
                    onSelect = function() exports.scully_emotemenu:cancelEmote() end,
                },
                {
                    id = 'emotes-walk',
                    label = 'Reset walk',
                    icon = 'person-walking',
                    onSelect = function() exports.scully_emotemenu:resetWalk() end,
                },
                {
                    id = 'emotes-face',
                    label = 'Reset face',
                    icon = 'face-smile',
                    onSelect = function() exports.scully_emotemenu:resetExpression() end,
                },
            },
        })
        lib.addRadialItem({
            id = 'emotes',
            label = 'Emotes',
            icon = 'masks-theater',
            menu = 'integrationEmotesMenu',
        })
    end
end
