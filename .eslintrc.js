module.exports = {
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2017,
        "sourceType": "module",
     },
    "rules": {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
        ],
        "indent-legacy": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
        ],
        "max-lines": [
            "error", {
                "max": 300,
                "skipBlankLines": true,
                "skipComments": true
            }
        ]
    }
};