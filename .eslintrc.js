module.exports = {
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module",
        "ecmaFeatures": {
            "impliedStrict": true
        }
    },
    "rules": {
        "id-length": "off",
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
        "line-comment-position": "off",
        "max-lines": [
            "error", {
                "max": 300,
                "skipBlankLines": true,
                "skipComments": true
            }
        ],
        "max-params": [
            "error",
            5
        ],
        "multiline-ternary": "off",
        "no-await-in-loop": "warn",
        "no-inline-comments": "off",
        "no-ternary": "off",
        "padded-blocks": [
            "warn",
            "never"
        ],
    }
};