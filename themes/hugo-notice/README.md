# hugo-notice

[![Awesome](https://awesome.re/badge.svg)](https://github.com/budparr/awesome-hugo)

## About

A [Hugo](https://gohugo.io) theme component providing a shortcode: `notice` to display nice notices. Four notice types are provided: `warning`, `info`, `note` and `tip`.

This component comes with __12 localizations__: English, French, German, Italian, Portuguese, Spanish, Chinese, Russian, Turkish, Arabic, Polish and Finnish. Other languages welcome! Send your pull request.

![Screenshot](screenshot.png)

## Usage

1. Add the `hugo-notice` as a submodule to be able to get upstream changes later `git submodule add https://github.com/martignoni/hugo-notice.git themes/hugo-notice`
2. Add `hugo-notice` as the left-most element of the `theme` list variable in your site's or theme's configuration file `config.yaml` or `config.toml`. Example, with `config.yaml`:
    ```yaml
    theme: ["hugo-notice", "my-theme"]
    ```
    or, with `config.toml`,
    ```toml
    theme = ["hugo-notice", "my-theme"]
    ```
3. In your site, use the shortcode, this way:
    ```go
    {{< notice warning >}}
    This is a warning notice. Be warned!
    {{< /notice >}}
    ```
    or
    ```go
    {{< notice tip >}}
    This is a very good tip.
    {{< /notice >}}
    ```

### Credits

Copyright © 2019 onwards, Nicolas Martignoni nicolas@martignoni.net.

Thanks to
- [Geraldo Ribeiro](https://github.com/geraldolsribeiro) for the Portuguese localization.
- [thatrocketx](https://github.com/thatrocketx) for the Italian localization.
- [casaqori](https://github.com/casaqori) for the Spanish localization.
- [理头张](https://github.com/qidongz) for the Chinese localization.
- [Алексей Корнеев](https://github.com/korney4eg) for the Russian localization.
- [Ahmad Al Maaz](https://github.com/Music47ell) for the Turkish and Arabic localizations.
- [Rafal S.](https://github.com/sulik76) for the Polish localization.
- [Oskari J. Manninen](https://github.com/x7Gv) for the Finnish localization.
