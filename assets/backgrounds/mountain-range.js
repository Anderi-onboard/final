/* BourneWise · animated mountain-range background (paper skin).
   Usage: place <div class="mtn-bg" aria-hidden="true"></div> anywhere and load
   this script. It injects the layered SVG, expands contour lines, and scopes its
   own CSS. Style the .mtn-bg box (position/size/opacity) from the host page.
   Ten parallax ridges flow at different speeds; six clouds drift over them. */
(function () {
  "use strict";

  var CSS = ''
    + '.mtn-bg{overflow:hidden;contain:strict}'
    + '.mtn-bg>svg{display:block;width:100%;height:100%}'
    /* ten ridges, ALL SYNCHRONISED to the same 72-stop timeline
       (shared duration, shared percentages, zero delay) so at any
       moment every ridge is showing colours from the SAME palette —
       the whole mountain briefly reads as one coherent combination,
       then crossfades to the next. These 72 palettes are user-supplied
       reference combinations (each already a genuine multi-hue mix,
       not one hue tinted/shaded) rather than named brand references —
       36 mixed cool/warm palettes plus 36 warm-toned companions
       (terracotta/rust/amber/gold/burgundy/coral/ochre/sienna families)
       built to the same rule. Each palette's 3-4 actual colours are
       densified into 10 ridge tones by adding tints/shades of those
       SAME colours (never a new hue), then ordered light-to-dark so
       the ridges still read as atmospheric perspective (hazy/far at
       the top, rich/near at the bottom) while keeping every one of the
       source colours intact. The 72 palettes, by dominant tones:
       Peach & steel blue, Periwinkle & navy, Aubergine & gold, Royal blue & cream, Slate & fawn, Cream & harbor blue, Powder blue & rosewood, Sky & teal, Midnight & apricot, Dove grey & linen, Frost & mist blue, Cerulean & marigold, Garnet & ember, Cornflower & rust, Honey & navy, Cobalt & tangerine, Fog & bronze, Heather & butter, Camel & powder, Linen & indigo, Umber & apricot, Marigold & plum, Parchment & cocoa, Navy & paprika, Ivory & cobalt, Lilac & violet, Navy & sand, Onyx & peach, Bone & jet, Powder & tan, Sienna & powder, Butter & cerulean, Navy & blush, Slate & cream, Charcoal & terracotta, Navy & wheat, Terracotta & clay, Rust & amber, Paprika & gold, Burnt sienna & cream, Cinnamon & honey, Brick & ochre, Copper & blush, Marigold & maroon, Saffron & rust, Chestnut & peach, Coral & garnet, Honey & sienna, Ember & cream, Sunset gold & rust, Clay & butterscotch, Pumpkin & cream, Olive & rust, Bronze & peach, Cayenne & marigold, Amber & wine, Tangerine & sepia, Persimmon & bronze, Cider & maple, Ochre & burgundy, Poppy & gold, Adobe & sand, Cognac & rose, Papaya & rust, Ochre & espresso, Tomato & mustard, Terracotta & espresso, Marmalade & clove, Camellia & rust, Sepia & tangerine, Ochre & cranberry, Honeycomb & mahogany
       */
    + '@keyframes mtn-sys-l1{0%,100%{fill:#FCF3E9}1.389%{fill:#E9F0FB}2.778%{fill:#FBEFD4}4.167%{fill:#FBF5EA}5.556%{fill:#DDE0E2}6.944%{fill:#F7F3EE}8.333%{fill:#ECF1F9}9.722%{fill:#EAF1FB}11.111%{fill:#EFB77E}12.5%{fill:#F5F3F0}13.889%{fill:#F0F6F9}15.278%{fill:#E9F2FB}16.667%{fill:#EDE0C2}18.056%{fill:#EDE4D0}19.444%{fill:#FBF5E9}20.833%{fill:#EDCB93}22.222%{fill:#F0F2F5}23.611%{fill:#F9F4E6}25%{fill:#F8F5EC}26.389%{fill:#F6F3EF}27.778%{fill:#F0DAB8}29.167%{fill:#F2E3B2}30.556%{fill:#F8F4EC}31.944%{fill:#D99C5D}33.333%{fill:#F8F4EC}34.722%{fill:#F7F4ED}36.111%{fill:#F0DCC0}37.5%{fill:#F0DCC8}38.889%{fill:#F6F4EF}40.278%{fill:#EEF1F7}41.667%{fill:#C4D4E4}43.056%{fill:#FBF7E9}44.444%{fill:#F8EDED}45.833%{fill:#F7F4EE}47.222%{fill:#D8D8D4}48.611%{fill:#DCBF8E}50%{fill:#FAF4EB}51.389%{fill:#FDF6E8}52.778%{fill:#FBF6E9}54.167%{fill:#F9F4EB}55.556%{fill:#FCF6E9}56.944%{fill:#FAF5EB}58.333%{fill:#FBF1E9}59.722%{fill:#FDF9E7}61.111%{fill:#FDF7E8}62.5%{fill:#FAF3EA}63.889%{fill:#FCF0E9}65.278%{fill:#FDF7E8}66.667%{fill:#F9F5EB}68.056%{fill:#FDF7E7}69.444%{fill:#FAF3EB}70.833%{fill:#FDF5E8}72.222%{fill:#FAF6EB}73.611%{fill:#FBF3E9}75%{fill:#FCF8E8}76.389%{fill:#FBF6EA}77.778%{fill:#FDF4E7}79.167%{fill:#FCF5E9}80.556%{fill:#FCF5E9}81.944%{fill:#FBF6E9}83.333%{fill:#FDF8E7}84.722%{fill:#FAF4EB}86.111%{fill:#FAF1EA}87.5%{fill:#FDF5E7}88.889%{fill:#FAF5EA}90.278%{fill:#FCF7E8}91.667%{fill:#FAF4EB}93.056%{fill:#FDF6E8}94.444%{fill:#FBEFE9}95.833%{fill:#FAF4EA}97.222%{fill:#FAF6EA}98.611%{fill:#FCF7E8}}'
    + '@keyframes mtn-sys-l2{0%,100%{fill:#FBF3E9}1.389%{fill:#EAF0FB}2.778%{fill:#F8DD9F}4.167%{fill:#F5E3C4}5.556%{fill:#E8DDC3}6.944%{fill:#F6F3EE}8.333%{fill:#F0F4FA}9.722%{fill:#EAF2FA}11.111%{fill:#A0A3C3}12.5%{fill:#DEE0E1}13.889%{fill:#EDF3F8}15.278%{fill:#EEF5FC}16.667%{fill:#E3CB94}18.056%{fill:#B9D8EB}19.444%{fill:#F4DFBB}20.833%{fill:#9EA5CF}22.222%{fill:#F0F2F4}23.611%{fill:#F5EBD0}25%{fill:#F7F2E6}26.389%{fill:#F7F6F2}27.778%{fill:#E9C287}29.167%{fill:#ECD280}30.556%{fill:#F8F4ED}31.944%{fill:#E0B052}33.333%{fill:#F8F4ED}34.722%{fill:#F9F6F1}36.111%{fill:#DEC8A4}37.5%{fill:#E7C099}38.889%{fill:#F7F6F2}40.278%{fill:#F1F4F8}41.667%{fill:#E2C297}43.056%{fill:#EDF2F8}44.444%{fill:#F2D8D8}45.833%{fill:#F2ECE2}47.222%{fill:#E3C09E}48.611%{fill:#E0C088}50%{fill:#F9F4EB}51.389%{fill:#FDF8ED}52.778%{fill:#FCF8EE}54.167%{fill:#F9F4EC}55.556%{fill:#FBF6E9}56.944%{fill:#F8F0DF}58.333%{fill:#FBF1EA}59.722%{fill:#FDF5D6}61.111%{fill:#FDF7E5}62.5%{fill:#FAF3EB}63.889%{fill:#FBF0E9}65.278%{fill:#FDF9ED}66.667%{fill:#F9F5EC}68.056%{fill:#FDF1D6}69.444%{fill:#F9F3EB}70.833%{fill:#FDF7ED}72.222%{fill:#F7F2DE}73.611%{fill:#FCF5EE}75%{fill:#FBF2D4}76.389%{fill:#F9EFD9}77.778%{fill:#FDF4E8}79.167%{fill:#FAEEDB}80.556%{fill:#FBF5E9}81.944%{fill:#F8EED2}83.333%{fill:#FDF5DE}84.722%{fill:#F9F3E7}86.111%{fill:#FAF1EB}87.5%{fill:#FDF5E6}88.889%{fill:#F8F1E0}90.278%{fill:#FBF1D4}91.667%{fill:#F9F4EB}93.056%{fill:#FDF3DE}94.444%{fill:#FBEFEA}95.833%{fill:#FAF4EB}97.222%{fill:#F8EFD9}98.611%{fill:#FCF7E9}}'
    + '@keyframes mtn-sys-l3{0%,100%{fill:#F7DFC0}1.389%{fill:#CBDCF7}2.778%{fill:#ECC481}4.167%{fill:#869DE0}5.556%{fill:#DBD1C2}6.944%{fill:#F2ECE2}8.333%{fill:#DCE7F5}9.722%{fill:#E4EEFA}11.111%{fill:#ED9B48}12.5%{fill:#E7E1D3}13.889%{fill:#ECF2F9}15.278%{fill:#DCEBFA}16.667%{fill:#E17447}18.056%{fill:#E0CEA5}19.444%{fill:#DDC7A0}20.833%{fill:#7C8CD8}22.222%{fill:#E4E9EE}23.611%{fill:#EFE0B8}25%{fill:#F2E9D2}26.389%{fill:#EFEAE0}27.778%{fill:#DCB08A}29.167%{fill:#E8C24C}30.556%{fill:#F5EFE2}31.944%{fill:#D2802C}33.333%{fill:#F2E9D8}34.722%{fill:#F2ECDE}36.111%{fill:#E8C390}37.5%{fill:#96ABCF}38.889%{fill:#F0ECE2}40.278%{fill:#DCE4F0}41.667%{fill:#9BB8D5}43.056%{fill:#FBF7EA}44.444%{fill:#EAC4C4}45.833%{fill:#EAE2D2}47.222%{fill:#C0C0B4}48.611%{fill:#D2A860}50%{fill:#F0DEC0}51.389%{fill:#FBEAC8}52.778%{fill:#F5E4B8}54.167%{fill:#F2E6D0}55.556%{fill:#F7E7C0}56.944%{fill:#EFDAB0}58.333%{fill:#F5D8C0}59.722%{fill:#FBE8A0}61.111%{fill:#FAE6B0}62.5%{fill:#F2DCC0}63.889%{fill:#F7D8C4}65.278%{fill:#FAE8B8}66.667%{fill:#EFE2C6}68.056%{fill:#FBE0A0}69.444%{fill:#F0DCC0}70.833%{fill:#FBE6C4}72.222%{fill:#EDE0B0}73.611%{fill:#F5D8B8}75%{fill:#F7E4A0}76.389%{fill:#F2DCA8}77.778%{fill:#FBE0B8}79.167%{fill:#F5D8A8}80.556%{fill:#F7E4C0}81.944%{fill:#F2DCA0}83.333%{fill:#FBE6A8}84.722%{fill:#F0DCB8}86.111%{fill:#F2D8C4}87.5%{fill:#FBE0B0}88.889%{fill:#F0DCB0}90.278%{fill:#F7E0A0}91.667%{fill:#F0DEC0}93.056%{fill:#FAE0A8}94.444%{fill:#F5D0C0}95.833%{fill:#F2DEC0}97.222%{fill:#F0DCA8}98.611%{fill:#F7E6B8}}'
    + '@keyframes mtn-sys-l4{0%,100%{fill:#94BCDA}1.389%{fill:#F7E4C8}2.778%{fill:#E8AE4D}4.167%{fill:#ECB75D}5.556%{fill:#BDC4CA}6.944%{fill:#D2C0A8}8.333%{fill:#9DB0C7}9.722%{fill:#B7D0F2}11.111%{fill:#7B7FB0}12.5%{fill:#E4DFD3}13.889%{fill:#EEF3F7}15.278%{fill:#5C93E0}16.667%{fill:#D2531E}18.056%{fill:#8BC0E1}19.444%{fill:#EEC989}20.833%{fill:#E8B460}22.222%{fill:#D9A860}23.611%{fill:#C4C6CD}25%{fill:#ECE0CD}26.389%{fill:#D9C7A8}27.778%{fill:#D2925C}29.167%{fill:#C9A468}30.556%{fill:#E8D4A0}31.944%{fill:#D99B21}33.333%{fill:#D2A860}34.722%{fill:#CBC0E0}36.111%{fill:#D2B078}37.5%{fill:#6C8CC0}38.889%{fill:#D7C1A2}40.278%{fill:#C0D0E4}41.667%{fill:#D9A868}43.056%{fill:#F0E8D0}44.444%{fill:#E6ACAC}45.833%{fill:#E3D3B9}47.222%{fill:#D9A470}48.611%{fill:#D9AA57}50%{fill:#E0A868}51.389%{fill:#E8A23C}52.778%{fill:#E8B23C}54.167%{fill:#D98E4A}55.556%{fill:#E0A85C}56.944%{fill:#D9A03C}58.333%{fill:#E0A088}59.722%{fill:#E8C24C}61.111%{fill:#E8B850}62.5%{fill:#E0A87A}63.889%{fill:#E88A6A}65.278%{fill:#E0A85E}66.667%{fill:#E0783C}68.056%{fill:#DB6D3E}69.444%{fill:#D9A868}70.833%{fill:#E88C3C}72.222%{fill:#C9A852}73.611%{fill:#D9A468}75%{fill:#E8B850}76.389%{fill:#E0A048}77.778%{fill:#E88C40}79.167%{fill:#E07C3C}80.556%{fill:#D99A50}81.944%{fill:#D9A448}83.333%{fill:#E8B048}84.722%{fill:#D9AC70}86.111%{fill:#D9946A}87.5%{fill:#E8943C}88.889%{fill:#D9A860}90.278%{fill:#E0C048}91.667%{fill:#D9A868}93.056%{fill:#E89438}94.444%{fill:#E08868}95.833%{fill:#E5976F}97.222%{fill:#D9A448}98.611%{fill:#E0AC50}}'
    + '@keyframes mtn-sys-l5{0%,100%{fill:#85AACD}1.389%{fill:#F2CC95}2.778%{fill:#524195}4.167%{fill:#3450DB}5.556%{fill:#DBC798}6.944%{fill:#C3A67F}8.333%{fill:#B78592}9.722%{fill:#8DB0E7}11.111%{fill:#56598C}12.5%{fill:#E0DBCB}13.889%{fill:#DCE8F5}15.278%{fill:#E8A94D}16.667%{fill:#BB1B1B}18.056%{fill:#D5B878}19.444%{fill:#D2B073}20.833%{fill:#7581BF}22.222%{fill:#8299B2}23.611%{fill:#EDD89F}25%{fill:#E8D5A4}26.389%{fill:#C8AD92}27.778%{fill:#9C4832}29.167%{fill:#877C8A}30.556%{fill:#E1C16F}31.944%{fill:#425892}33.333%{fill:#C89132}34.722%{fill:#AB97D1}36.111%{fill:#4C6C90}37.5%{fill:#4C6C90}38.889%{fill:#C9A878}40.278%{fill:#96B2D6}41.667%{fill:#B0602C}43.056%{fill:#CCDCEC}44.444%{fill:#4C74AC}45.833%{fill:#5C6C84}47.222%{fill:#C88850}48.611%{fill:#5C6884}50%{fill:#D28455}51.389%{fill:#DC703B}52.778%{fill:#DD573B}54.167%{fill:#CC582B}55.556%{fill:#CE7F4D}56.944%{fill:#D34D2E}58.333%{fill:#D28E76}59.722%{fill:#E4B218}61.111%{fill:#DC763B}62.5%{fill:#DA8A48}63.889%{fill:#CE6767}65.278%{fill:#D77B2F}66.667%{fill:#CD3723}68.056%{fill:#E8A430}69.444%{fill:#CB814F}70.833%{fill:#DA7741}72.222%{fill:#C87438}73.611%{fill:#D38936}75%{fill:#E05534}76.389%{fill:#D2861E}77.778%{fill:#C76F3B}79.167%{fill:#D44D2A}80.556%{fill:#C97543}81.944%{fill:#C68A23}83.333%{fill:#E04234}84.722%{fill:#C27B56}86.111%{fill:#BE7062}87.5%{fill:#DC703B}88.889%{fill:#D3902E}90.278%{fill:#E04A34}91.667%{fill:#D38F36}93.056%{fill:#D45228}94.444%{fill:#DC5C3B}95.833%{fill:#D9A868}97.222%{fill:#C68A23}98.611%{fill:#D89520}}'
    + '@keyframes mtn-sys-l6{0%,100%{fill:#66A2D0}1.389%{fill:#6C93F5}2.778%{fill:#3B2E70}4.167%{fill:#2B53CC}5.556%{fill:#C9B79C}6.944%{fill:#6888AA}8.333%{fill:#7593B7}9.722%{fill:#85B1EC}11.111%{fill:#3E416C}12.5%{fill:#C0C4C8}13.889%{fill:#CCD4DA}15.278%{fill:#2873DC}16.667%{fill:#A31F1C}18.056%{fill:#5CA8D8}19.444%{fill:#C99944}20.833%{fill:#E89246}22.222%{fill:#D3902E}23.611%{fill:#A3A8B6}25%{fill:#B8C6D2}26.389%{fill:#CCAF7D}27.778%{fill:#8C4A28}29.167%{fill:#BC8C3D}30.556%{fill:#DFB26D}31.944%{fill:#B8401C}33.333%{fill:#1C3868}34.722%{fill:#A896D0}36.111%{fill:#415E98}37.5%{fill:#35506F}38.889%{fill:#5C7CB0}40.278%{fill:#D2B888}41.667%{fill:#9B5039}43.056%{fill:#F5EAC0}44.444%{fill:#445388}45.833%{fill:#445B88}47.222%{fill:#AF6C31}48.611%{fill:#445B88}50%{fill:#DB8E35}51.389%{fill:#D88814}52.778%{fill:#D89A14}54.167%{fill:#C77124}55.556%{fill:#DC9028}56.944%{fill:#BD8420}58.333%{fill:#D97B57}59.722%{fill:#CD3725}61.111%{fill:#E7A619}62.5%{fill:#C46E50}63.889%{fill:#E56235}65.278%{fill:#DC8F2A}66.667%{fill:#C95B1B}68.056%{fill:#C15020}69.444%{fill:#D38F36}70.833%{fill:#D86F14}72.222%{fill:#B18E31}73.611%{fill:#C48442}75%{fill:#E7A619}76.389%{fill:#AC293E}77.778%{fill:#DB6F15}79.167%{fill:#C95F1B}80.556%{fill:#CB7F26}81.944%{fill:#A52A34}83.333%{fill:#E19A17}84.722%{fill:#D2933F}86.111%{fill:#D27338}87.5%{fill:#D87814}88.889%{fill:#94593A}90.278%{fill:#D2AC1E}91.667%{fill:#CC582B}93.056%{fill:#D57813}94.444%{fill:#DB6135}95.833%{fill:#E0743C}97.222%{fill:#B7293D}98.611%{fill:#AB7515}}'
    + '@keyframes mtn-sys-l7{0%,100%{fill:#5A8FC0}1.389%{fill:#336BF6}2.778%{fill:#2B4272}4.167%{fill:#1E3FA0}5.556%{fill:#9BA8B4}6.944%{fill:#B68C54}8.333%{fill:#A65E70}9.722%{fill:#5C8FE0}11.111%{fill:#3E3A63}12.5%{fill:#D6C9AC}13.889%{fill:#AECBEB}15.278%{fill:#E59218}16.667%{fill:#8C1212}18.056%{fill:#D2661E}19.444%{fill:#6787A4}20.833%{fill:#4C63D0}22.222%{fill:#5C7CA0}23.611%{fill:#D2A860}25%{fill:#DEC8A2}26.389%{fill:#B8916A}27.778%{fill:#743322}29.167%{fill:#6C5E70}30.556%{fill:#DBAF3C}31.944%{fill:#AC7916}33.333%{fill:#202E58}34.722%{fill:#A08FC1}36.111%{fill:#35506F}37.5%{fill:#40404C}38.889%{fill:#416093}40.278%{fill:#B99877}41.667%{fill:#86471E}43.056%{fill:#E5D4A3}44.444%{fill:#375989}45.833%{fill:#425066}47.222%{fill:#414B67}48.611%{fill:#424D66}50%{fill:#C1652E}51.389%{fill:#C1541E}52.778%{fill:#C23A1E}54.167%{fill:#A0431E}55.556%{fill:#B5622E}56.944%{fill:#A83A20}58.333%{fill:#C86A48}59.722%{fill:#B58D0E}61.111%{fill:#C15A1E}62.5%{fill:#C76D23}63.889%{fill:#C23A3A}65.278%{fill:#B0601E}66.667%{fill:#A02818}68.056%{fill:#CE8812}69.444%{fill:#B26430}70.833%{fill:#C15A22}72.222%{fill:#A05A28}73.611%{fill:#AF6D22}75%{fill:#C23A1A}76.389%{fill:#A56713}77.778%{fill:#A0562A}79.167%{fill:#A83A1E}80.556%{fill:#A85A2C}81.944%{fill:#996A17}83.333%{fill:#C1281A}84.722%{fill:#A85E38}86.111%{fill:#A85040}87.5%{fill:#C1541E}88.889%{fill:#AA721F}90.278%{fill:#C1301A}91.667%{fill:#AF7222}93.056%{fill:#A83E1C}94.444%{fill:#C1401E}95.833%{fill:#D38F36}97.222%{fill:#996A17}98.611%{fill:#993B25}}'
    + '@keyframes mtn-sys-l8{0%,100%{fill:#3789C7}1.389%{fill:#0647EB}2.778%{fill:#251C4A}4.167%{fill:#13278C}5.556%{fill:#D1B26A}6.944%{fill:#4B6C8E}8.333%{fill:#4F76A5}9.722%{fill:#5091E9}11.111%{fill:#282A4A}12.5%{fill:#CEC4A5}13.889%{fill:#A0C8E2}15.278%{fill:#2B55B7}16.667%{fill:#761311}18.056%{fill:#A54D13}19.444%{fill:#4C6B87}20.833%{fill:#4C5CB0}22.222%{fill:#2E3A4C}23.611%{fill:#8188A0}25%{fill:#E0C174}26.389%{fill:#C09750}27.778%{fill:#633219}29.167%{fill:#966D2B}30.556%{fill:#D89A3C}31.944%{fill:#2E406E}33.333%{fill:#0F203D}34.722%{fill:#8A6DC3}36.111%{fill:#2E4573}37.5%{fill:#21354B}38.889%{fill:#2D466F}40.278%{fill:#C7A15B}41.667%{fill:#743928}43.056%{fill:#DCC274}44.444%{fill:#2F3B65}45.833%{fill:#2F4165}47.222%{fill:#865121}48.611%{fill:#2F4165}50%{fill:#BC711C}51.389%{fill:#A8680C}52.778%{fill:#A8770C}54.167%{fill:#9B5618}55.556%{fill:#B37218}56.944%{fill:#916314}58.333%{fill:#CE5629}59.722%{fill:#A0281A}61.111%{fill:#B9830F}62.5%{fill:#A85234}63.889%{fill:#CD4415}65.278%{fill:#B57219}66.667%{fill:#9B4311}68.056%{fill:#9E670A}69.444%{fill:#AF7222}70.833%{fill:#A8540C}72.222%{fill:#896C22}73.611%{fill:#A0682E}75%{fill:#B9830F}76.389%{fill:#811C2C}77.778%{fill:#AB540C}79.167%{fill:#9B4711}80.556%{fill:#9F621A}81.944%{fill:#7A1C24}83.333%{fill:#B2790E}84.722%{fill:#B47725}86.111%{fill:#B05822}87.5%{fill:#A85C0C}88.889%{fill:#6E4028}90.278%{fill:#A58613}91.667%{fill:#A0431E}93.056%{fill:#A55B0B}94.444%{fill:#BC471C}95.833%{fill:#AF7222}97.222%{fill:#8C1C2C}98.611%{fill:#6E2818}}'
    + '@keyframes mtn-sys-l9{0%,100%{fill:#2E6C9E}1.389%{fill:#13318C}2.778%{fill:#1A2A4B}4.167%{fill:#0A185D}5.556%{fill:#8B7B6E}6.944%{fill:#152238}8.333%{fill:#2B6E73}9.722%{fill:#2B7080}11.111%{fill:#262342}12.5%{fill:#9FA8B0}13.889%{fill:#AAB8C4}15.278%{fill:#1859B3}16.667%{fill:#5C0A0A}18.056%{fill:#4D3A2B}19.444%{fill:#1B2C4C}20.833%{fill:#E07516}22.222%{fill:#181F2A}23.611%{fill:#C89132}25%{fill:#92ABC0}26.389%{fill:#1C2438}27.778%{fill:#4A1F14}29.167%{fill:#2A2438}30.556%{fill:#3A2418}31.944%{fill:#8A2D11}33.333%{fill:#101830}34.722%{fill:#866BC3}36.111%{fill:#21354B}37.5%{fill:#25252F}38.889%{fill:#181818}40.278%{fill:#A87C50}41.667%{fill:#5B2E11}43.056%{fill:#5C8CC0}44.444%{fill:#243F64}45.833%{fill:#293546}47.222%{fill:#2A3146}48.611%{fill:#293246}50%{fill:#6B3018}51.389%{fill:#5A1F0E}52.778%{fill:#4A1408}54.167%{fill:#4A200E}55.556%{fill:#3A1D10}56.944%{fill:#401810}58.333%{fill:#6A2E1E}59.722%{fill:#3A0F0A}61.111%{fill:#501E0E}62.5%{fill:#401E14}63.889%{fill:#4A1414}65.278%{fill:#3E1B0C}66.667%{fill:#3E0F0A}68.056%{fill:#481A0A}69.444%{fill:#5A2E18}70.833%{fill:#4A200E}72.222%{fill:#402410}73.611%{fill:#3A1C0E}75%{fill:#481008}76.389%{fill:#380A10}77.778%{fill:#3E200E}79.167%{fill:#401810}80.556%{fill:#3E1E0E}81.944%{fill:#300A0E}83.333%{fill:#480C0A}84.722%{fill:#5A3018}86.111%{fill:#4A1E1C}87.5%{fill:#481C0A}88.889%{fill:#2E180C}90.278%{fill:#400C08}91.667%{fill:#2E1810}93.056%{fill:#3A140C}94.444%{fill:#4A1810}95.833%{fill:#3A200E}97.222%{fill:#340A10}98.611%{fill:#2C0E08}}'
    + '@keyframes mtn-sys-l10{0%,100%{fill:#1E4F76}1.389%{fill:#0B1F5C}2.778%{fill:#0A1222}4.167%{fill:#091845}5.556%{fill:#705F51}6.944%{fill:#060B13}8.333%{fill:#1A494C}9.722%{fill:#1B4D58}11.111%{fill:#100F1E}12.5%{fill:#C7B283}13.889%{fill:#5E81A0}15.278%{fill:#1E3F8C}16.667%{fill:#460A08}18.056%{fill:#2A1F16}19.444%{fill:#0B1424}20.833%{fill:#2B44B9}22.222%{fill:#090C11}23.611%{fill:#9F7123}25%{fill:#D2B076}26.389%{fill:#090C13}27.778%{fill:#371B0C}29.167%{fill:#100D17}30.556%{fill:#130B07}31.944%{fill:#1C2848}33.333%{fill:#040B15}34.722%{fill:#8068B0}36.111%{fill:#1C2C4C}37.5%{fill:#0C0C10}38.889%{fill:#0D0C0C}40.278%{fill:#B38737}41.667%{fill:#4C2418}43.056%{fill:#3B70A9}44.444%{fill:#1C2440}45.833%{fill:#1C2840}47.222%{fill:#141824}48.611%{fill:#1C2840}50%{fill:#3F1B0C}51.389%{fill:#2A0E05}52.778%{fill:#180602}54.167%{fill:#1B0B04}55.556%{fill:#140A05}56.944%{fill:#150705}58.333%{fill:#401A10}59.722%{fill:#160503}61.111%{fill:#210C05}62.5%{fill:#160A06}63.889%{fill:#1F0707}65.278%{fill:#160904}66.667%{fill:#160503}68.056%{fill:#170803}69.444%{fill:#2F170B}70.833%{fill:#1B0B04}72.222%{fill:#150B05}73.611%{fill:#150A04}75%{fill:#170502}76.389%{fill:#160306}77.778%{fill:#150B04}79.167%{fill:#150705}80.556%{fill:#150A04}81.944%{fill:#160406}83.333%{fill:#170303}84.722%{fill:#2F180B}86.111%{fill:#220D0C}87.5%{fill:#170903}88.889%{fill:#150A05}90.278%{fill:#170402}91.667%{fill:#130A06}93.056%{fill:#160704}94.444%{fill:#1D0905}95.833%{fill:#150B04}97.222%{fill:#160406}98.611%{fill:#160703}}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    /* fill is a PAINT property: animating it forces a full re-raster of these huge ridge
       textures every frame, so it's stepped rather than smoothly interpolated to cut
       repaints. IMPORTANT: steps(N) must be >= the number of colour stops (72) — fewer
       steps than stops lands most sampled frames on a browser-interpolated BLEND between
       two palettes instead of a clean one, which reads as muddy/mixed. steps(72) gives
       each of the 72 palettes its own clean, unblended hold (~4s each @ 288s total) with
       one jump every 4s. translate flows stay GPU-composited regardless. */
    + '.mtn-bg .fill{animation-iteration-count:infinite;animation-timing-function:steps(72)}'
    + '.mtn-bg [class^="flow-"]{will-change:transform}'
    + '.mtn-bg .cloud-bob{animation:mtn-cloud-bob 8s ease-in-out infinite}'
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(0,0,0,0.24);stroke-width:1.2}'
    + '.mtn-bg .l1{animation-name:mtn-sys-l1;animation-duration:288s;animation-delay:0s;opacity:.48}'
    + '.mtn-bg .l2{animation-name:mtn-sys-l2;animation-duration:288s;animation-delay:0s;opacity:.60}'
    + '.mtn-bg .l3{animation-name:mtn-sys-l3;animation-duration:288s;animation-delay:0s;opacity:.72}'
    + '.mtn-bg .l4{animation-name:mtn-sys-l4;animation-duration:288s;animation-delay:0s;opacity:.83}'
    + '.mtn-bg .l5{animation-name:mtn-sys-l5;animation-duration:288s;animation-delay:0s;opacity:.90}'
    + '.mtn-bg .l6{animation-name:mtn-sys-l6;animation-duration:288s;animation-delay:0s;opacity:.95}'
    + '.mtn-bg .l7{animation-name:mtn-sys-l7;animation-duration:288s;animation-delay:0s;opacity:.97}'
    + '.mtn-bg .l8{animation-name:mtn-sys-l8;animation-duration:288s;animation-delay:0s;opacity:1}'
    + '.mtn-bg .l9{animation-name:mtn-sys-l9;animation-duration:288s;animation-delay:0s;opacity:1}'
    + '.mtn-bg .l10{animation-name:mtn-sys-l10;animation-duration:288s;animation-delay:0s;opacity:1}'
    + '.mtn-bg .flow-1{animation:mtn-flow-l 145s linear infinite}.mtn-bg .flow-2{animation:mtn-flow-r 128s linear infinite}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 112s linear infinite}.mtn-bg .flow-4{animation:mtn-flow-r 96s linear infinite}'
    + '.mtn-bg .flow-5{animation:mtn-flow-l 82s linear infinite}.mtn-bg .flow-6{animation:mtn-flow-r 70s linear infinite}'
    + '.mtn-bg .flow-7{animation:mtn-flow-l 58s linear infinite}.mtn-bg .flow-8{animation:mtn-flow-r 48s linear infinite}'
    + '.mtn-bg .flow-9{animation:mtn-flow-l 40s linear infinite}.mtn-bg .flow-10{animation:mtn-flow-r 32s linear infinite}'
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 120s linear infinite}.mtn-bg .cloud-2{animation:mtn-cloud-l 96s linear infinite}'
    + '.mtn-bg .cloud-3{animation:mtn-cloud-r 74s linear -30s infinite}.mtn-bg .cloud-4{animation:mtn-cloud-l 132s linear -18s infinite}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 104s linear -50s infinite}.mtn-bg .cloud-6{animation:mtn-cloud-l 84s linear -12s infinite}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use{animation:none!important}}';

  var W = {
    1: "M -2000 188 L -1860 186 C -1777 186 -1763 150 -1680 150 C -1570 150 -1550 178 -1440 178 L -1240 178 C -1176 178 -1164 166 -1100 166 C -1045 166 -1035 188 -980 188 L -780 195 C -660 195 -640 144 -520 144 C -428 144 -412 189 -320 189 L 0 184 L 140 186 C 223 186 237 150 320 150 C 430 150 450 178 560 178 L 760 178 C 824 178 836 166 900 166 C 955 166 965 188 1020 188 L 1220 195 C 1340 195 1360 144 1480 144 C 1572 144 1588 189 1680 189 L 2000 184 L 2140 186 C 2223 186 2237 150 2320 150 C 2430 150 2450 178 2560 178 L 2760 178 C 2824 178 2836 166 2900 166 C 2955 166 2965 188 3020 188 L 3220 195 C 3340 195 3360 144 3480 144 C 3572 144 3588 189 3680 189 L 4000 184",
    2: "M -2000 229.33 L -1860 228 C -1777 228 -1763 204 -1680 204 C -1570 204 -1550 222.67 -1440 222.67 L -1240 222.67 C -1176 222.67 -1164 214.67 -1100 214.67 C -1045 214.67 -1035 229.33 -980 229.33 L -780 234 C -660 234 -640 200 -520 200 C -428 200 -412 230 -320 230 L 0 226.67 L 140 228 C 223 228 237 204 320 204 C 430 204 450 222.67 560 222.67 L 760 222.67 C 824 222.67 836 214.67 900 214.67 C 955 214.67 965 229.33 1020 229.33 L 1220 234 C 1340 234 1360 200 1480 200 C 1572 200 1588 230 1680 230 L 2000 226.67 L 2140 228 C 2223 228 2237 204 2320 204 C 2430 204 2450 222.67 2560 222.67 L 2760 222.67 C 2824 222.67 2836 214.67 2900 214.67 C 2955 214.67 2965 229.33 3020 229.33 L 3220 234 C 3340 234 3360 200 3480 200 C 3572 200 3588 230 3680 230 L 4000 226.67",
    3: "M -2000 270 L -1960 269 C -1872 269 -1848 214 -1760 214 C -1690 214 -1670 263 -1600 263 L -1330 258 C -1261 258 -1249 232 -1180 232 C -1074 232 -1056 265 -950 265 L -870 268 C -795 268 -775 205 -700 205 C -638 205 -622 277 -560 277 L -360 273 C -307 273 -293 240 -240 240 C -161 240 -139 267 -60 267 L 0 266 L 40 269 C 128 269 152 214 240 214 C 310 214 330 263 400 263 L 670 258 C 739 258 751 232 820 232 C 926 232 944 265 1050 265 L 1130 268 C 1205 268 1225 205 1300 205 C 1362 205 1378 277 1440 277 L 1640 273 C 1693 273 1707 240 1760 240 C 1839 240 1861 267 1940 267 L 2000 266 L 2040 269 C 2128 269 2152 214 2240 214 C 2310 214 2330 263 2400 263 L 2670 258 C 2739 258 2751 232 2820 232 C 2926 232 2944 265 3050 265 L 3130 268 C 3205 268 3225 205 3300 205 C 3362 205 3378 277 3440 277 L 3640 273 C 3693 273 3707 240 3760 240 C 3839 240 3861 267 3940 267 L 4000 266",
    4: "M -2000 374 L -1880 372 C -1742 372 -1718 282 -1580 282 C -1479 282 -1461 364 -1360 364 L -980 361 C -855 361 -845 308 -720 308 C -547 308 -533 368 -360 368 L 0 372 L 120 372 C 258 372 282 282 420 282 C 521 282 539 364 640 364 L 1020 361 C 1145 361 1155 308 1280 308 C 1453 308 1467 368 1640 368 L 2000 372 L 2120 372 C 2258 372 2282 282 2420 282 C 2521 282 2539 364 2640 364 L 3020 361 C 3145 361 3155 308 3280 308 C 3453 308 3467 368 3640 368 L 4000 372",
    5: "M -2000 440 L -1910 438 C -1835 438 -1815 356 -1740 356 C -1683 356 -1667 434 -1610 434 L -1320 432 C -1256 432 -1244 380 -1180 380 C -1093 380 -1077 440 -990 440 L -740 446 C -630 446 -610 340 -500 340 C -408 340 -392 441 -300 441 L 0 436 L 90 438 C 165 438 185 356 260 356 C 317 356 333 434 390 434 L 680 432 C 744 432 756 380 820 380 C 907 380 923 440 1010 440 L 1260 446 C 1370 446 1390 340 1500 340 C 1592 340 1608 441 1700 441 L 2000 436 L 2090 438 C 2165 438 2185 356 2260 356 C 2317 356 2333 434 2390 434 L 2680 432 C 2744 432 2756 380 2820 380 C 2907 380 2923 440 3010 440 L 3260 446 C 3370 446 3390 340 3500 340 C 3592 340 3608 441 3700 441 L 4000 436",
    6: "M -2000 500 L -1690 498 C -1602 498 -1568 330 -1480 330 C -1413 330 -1387 496 -1320 496 L -820 495 C -723 495 -697 366 -600 366 C -468 366 -432 498 -300 498 L 0 500 L 310 498 C 398 498 432 330 520 330 C 587 330 613 496 680 496 L 1180 495 C 1277 495 1303 366 1400 366 C 1532 366 1568 498 1700 498 L 2000 500 L 2310 498 C 2398 498 2432 330 2520 330 C 2587 330 2613 496 2680 496 L 3180 495 C 3277 495 3303 366 3400 366 C 3532 366 3568 498 3700 498 L 4000 500",
    7: "M -2000 524 L -1880 523.35 C -1742 523.35 -1718 494 -1580 494 C -1479 494 -1461 520.74 -1360 520.74 L -980 519.76 C -855 519.76 -845 502.48 -720 502.48 C -547 502.48 -533 522.04 -360 522.04 L 0 523.35 L 120 523.35 C 258 523.35 282 494 420 494 C 521 494 539 520.74 640 520.74 L 1020 519.76 C 1145 519.76 1155 502.48 1280 502.48 C 1453 502.48 1467 522.04 1640 522.04 L 2000 523.35 L 2120 523.35 C 2258 523.35 2282 494 2420 494 C 2521 494 2539 520.74 2640 520.74 L 3020 519.76 C 3145 519.76 3155 502.48 3280 502.48 C 3453 502.48 3467 522.04 3640 522.04 L 4000 523.35",
    8: "M -2000 538 L -1840 536 C -1752 536 -1728 512 -1640 512 C -1570 512 -1550 533 -1480 533 L -1150 531 C -1081 531 -1069 520 -1000 520 C -903 520 -887 538 -790 538 L -540 543 C -461 543 -439 508 -360 508 C -298 508 -282 538 -220 538 L 0 534 L 160 536 C 248 536 272 512 360 512 C 430 512 450 533 520 533 L 850 531 C 919 531 931 520 1000 520 C 1097 520 1113 538 1210 538 L 1460 543 C 1539 543 1561 508 1640 508 C 1702 508 1718 538 1780 538 L 2000 534 L 2160 536 C 2248 536 2272 512 2360 512 C 2430 512 2450 533 2520 533 L 2850 531 C 2919 531 2931 520 3000 520 C 3097 520 3113 538 3210 538 L 3460 543 C 3539 543 3561 508 3640 508 C 3702 508 3718 538 3780 538 L 4000 534",
    9: "M -2000 568 L -1780 566 C -1662 566 -1618 556 -1500 556 C -1366 556 -1314 561 -1180 561 L -800 561 C -674 561 -626 560 -500 560 C -391 560 -349 565 -240 565 L 0 566 L 220 566 C 338 566 382 556 500 556 C 634 556 686 561 820 561 L 1200 561 C 1326 561 1374 560 1500 560 C 1609 560 1651 565 1760 565 L 2000 566 L 2220 566 C 2338 566 2382 556 2500 556 C 2634 556 2686 561 2820 561 L 3200 561 C 3326 561 3374 560 3500 560 C 3609 560 3651 565 3760 565 L 4000 566",
    10: "M -2000 588 L -1760 588 C -1609 588 -1551 582 -1400 582 C -1266 582 -1214 587 -1080 587 L -700 587 C -574 587 -526 584 -400 584 C -240 584 -180 586 -20 586 L 0 586 L 240 588 C 391 588 449 582 600 582 C 734 582 786 587 920 587 L 1300 587 C 1426 587 1474 584 1600 584 C 1760 584 1820 586 1980 586 L 2000 586 L 2240 588 C 2391 588 2449 582 2600 582 C 2734 582 2786 587 2920 587 L 3300 587 C 3426 587 3474 584 3600 584 C 3760 584 3820 586 3980 586 L 4000 586"
  };
  var CLOUD = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30 C 116 32 116 44 100 42 C 96 50 76 48 70 40 C 64 50 40 50 34 40 C 22 44 6 42 18 30 Z";
  var CLOUDC = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30";

  /* ridge fill closes to the bottom; the curve is the open top edge for contours */
  function shape(i) { return W[i] + " L 4000 600 L -2000 600 Z"; }

  var LAYERS = [
    { n: 5, step: 14 }, { n: 6, step: 14 }, { n: 8, step: 13 }, { n: 12, step: 12 },
    { n: 14, step: 11 }, { n: 18, step: 10 }, { n: 12, step: 9 }, { n: 7, step: 8 },
    { n: 3, step: 7 }, { n: 2, step: 5 }
  ];
  var CLOUDS = [
    { t: "translate(180,12) scale(1.6)", o: .55, d: "0s" },
    { t: "translate(470,50) scale(1.0)", o: .78, d: "-2.8s" },
    { t: "translate(720,24) scale(1.25)", o: .88, d: "-5.4s" },
    { t: "translate(330,84) scale(0.8)", o: .70, d: "-1.6s" },
    { t: "translate(620,108) scale(0.92)", o: .66, d: "-4.0s" },
    { t: "translate(860,68) scale(0.7)", o: .82, d: "-6.8s" }
  ];

  function build(opts) {
    var vbw = (opts && opts.vbw) || 1000;
    var par = (opts && opts.par) || 'xMidYMid slice';
    var defs = '<defs>';
    for (var i = 1; i <= 10; i++) {
      defs += '<path id="mw' + i + '" d="' + shape(i) + '"/>';
      defs += '<path id="mw' + i + 'c" d="' + W[i] + '"/>';
    }
    defs += '<path id="mxy-cloud" d="' + CLOUD + '"/><path id="mxy-cloud-c" d="' + CLOUDC + '"/>';
    defs += '<clipPath id="mcloud-clip"><use href="#mxy-cloud"/></clipPath></defs>';

    var ridges = '';
    LAYERS.forEach(function (L, idx) {
      var i = idx + 1, contour = '';
      for (var k = 1; k <= L.n; k++) contour += '<use href="#mw' + i + 'c" y="' + (k * L.step).toFixed(2) + '"/>';
      ridges += '<g class="flow-' + i + '"><use href="#mw' + i + '" class="fill l' + i + '"/>'
        + '<g class="contour">' + contour + '</g></g>';
    });

    var clouds = '';
    CLOUDS.forEach(function (c, idx) {
      var cc = '';
      for (var y = 5; y <= 25; y += 5) cc += '<use href="#mxy-cloud-c" y="' + y + '"/>';
      clouds += '<g class="cloud-' + (idx + 1) + '"><g class="cloud-bob" style="animation-delay:' + c.d + '">'
        + '<g transform="' + c.t + '"><g clip-path="url(#mcloud-clip)">'
        + '<use href="#mxy-cloud" fill="#EA6632" opacity="' + c.o + '"/>'
        + '<g class="cloud-contour">' + cc + '</g></g></g></g></g>';
    });

    return '<svg viewBox="0 0 ' + vbw + ' 600" preserveAspectRatio="' + par + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mountain range">'
      + '<title>Layered mountain background</title>' + defs + ridges + clouds + '</svg>';
  }

  function init() {
    if (!document.getElementById('mtn-bg-css')) {
      var st = document.createElement('style');
      st.id = 'mtn-bg-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    document.querySelectorAll('.mtn-bg').forEach(function (el) {
      if (!el.firstElementChild) el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
