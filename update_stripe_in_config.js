const fs = require('fs');
var reward_config = JSON.parse(fs.readFileSync('./config.json'));
if (process.env.KEY_PRIVATE == undefined || process.env.KEY_PUBLIC == undefined)
{
    delete reward_config.extraConfig.StripeConfig
}
else
{
    reward_config.extraConfig.StripeConfig = {
        "keyPublic": process.env.KEY_PUBLIC,
        "keyPrivate": process.env.KEY_PRIVATE
    }
}

fs.writeFileSync('./config.json', JSON.stringify(reward_config));
