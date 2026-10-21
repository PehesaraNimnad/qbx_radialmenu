fx_version 'cerulean'
game 'gta5'

description 'qbx_radialmenu — with its own black & white radial UI (ox_lib compatible API)'
repository 'https://github.com/Qbox-project/qbx_radialmenu'
version '0.2.0'
ox_lib 'locale'

shared_scripts {
    '@ox_lib/init.lua',
    '@qbx_core/modules/lib.lua',
}

client_scripts {
    '@qbx_core/modules/playerdata.lua',
    'client/radial.lua', -- engine + NUI bridge, must load first
    'client/integrations.lua',
    'client/main.lua',
    'client/clothing.lua',
    'client/trunk.lua',
}

server_scripts {
    'server/*.lua',
}

ui_page 'web/index.html'

files {
    'config/client.lua',
    'locales/*.json',
    'web/index.html',
    'web/style.css',
    'web/app.js',
}

lua54 'yes'
use_experimental_fxv2_oal 'yes'
