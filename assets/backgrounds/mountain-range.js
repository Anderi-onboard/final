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
    /* ten ridges, ALL SYNCHRONISED to one shared timeline (same duration, same
       stops, same delay) so at any moment the whole mountain wears ONE palette,
       then crossfades to the next. the full 72-system seasonal rotation is BACK (restored from the
       pre-perf-pass build): 72 user-supplied reference palettes, each a
       10-tone ramp ordered light->dark with one deliberate contrast band,
       sequenced as a year passing - spring (10) -> summer (16) -> autumn (34)
       -> winter (12) and round again. 1440s cycle = ~20s per palette, so the
       colour genuinely changes while you sit with a reading. The perf
       machinery below (hold-then-blend keyframes, split fill/contour groups)
       is what makes 72 paint-animations affordable:
       Each palette holds ~24s of its 25s slot; holdify() below inserts the hold
       keyframes so the ~1s crossfade is the only window where ridges repaint. */
    + '@keyframes mtn-sys-l1{0%,100%{fill:#FCF3E9}1.389%{fill:#ECF1F9}2.778%{fill:#F9F4E6}4.167%{fill:#F8F5EC}5.556%{fill:#F7F4ED}6.944%{fill:#EEF1F7}8.333%{fill:#FBF7E9}9.722%{fill:#F8EDED}11.111%{fill:#FAF1EA}12.5%{fill:#FBEFE9}13.889%{fill:#E9F0FB}15.278%{fill:#FBF5EA}16.667%{fill:#EAF1FB}18.056%{fill:#E9F2FB}19.444%{fill:#EDCB93}20.833%{fill:#F0DCC0}22.222%{fill:#FBF1E9}23.611%{fill:#FCF0E9}25%{fill:#F9F5EB}26.389%{fill:#FDF7E7}27.778%{fill:#FCF8E8}29.167%{fill:#FDF4E7}30.556%{fill:#FDF8E7}31.944%{fill:#FAF4EB}33.333%{fill:#FDF5E7}34.722%{fill:#FCF7E8}36.111%{fill:#FBEFD4}37.5%{fill:#EDE0C2}38.889%{fill:#EDE4D0}40.278%{fill:#FBF5E9}41.667%{fill:#F0DAB8}43.056%{fill:#F2E3B2}44.444%{fill:#F8F4EC}45.833%{fill:#D99C5D}47.222%{fill:#C4D4E4}48.611%{fill:#DCBF8E}50%{fill:#FAF4EB}51.389%{fill:#FDF6E8}52.778%{fill:#FBF6E9}54.167%{fill:#F9F4EB}55.556%{fill:#FCF6E9}56.944%{fill:#FAF5EB}58.333%{fill:#FDF9E7}59.722%{fill:#FDF7E8}61.111%{fill:#FAF3EA}62.5%{fill:#FDF7E8}63.889%{fill:#FAF3EB}65.278%{fill:#FDF5E8}66.667%{fill:#FAF6EB}68.056%{fill:#FBF3E9}69.444%{fill:#FBF6EA}70.833%{fill:#FCF5E9}72.222%{fill:#FCF5E9}73.611%{fill:#FBF6E9}75%{fill:#FAF5EA}76.389%{fill:#FAF4EB}77.778%{fill:#FDF6E8}79.167%{fill:#FAF4EA}80.556%{fill:#FAF6EA}81.944%{fill:#FCF7E8}83.333%{fill:#DDE0E2}84.722%{fill:#F7F3EE}86.111%{fill:#EFB77E}87.5%{fill:#F5F3F0}88.889%{fill:#F0F6F9}90.278%{fill:#F0F2F5}91.667%{fill:#F6F3EF}93.056%{fill:#F8F4EC}94.444%{fill:#F0DCC8}95.833%{fill:#F6F4EF}97.222%{fill:#F7F4EE}98.611%{fill:#D8D8D4}}'
    + '@keyframes mtn-sys-l2{0%,100%{fill:#FBF3E9}1.389%{fill:#F0F4FA}2.778%{fill:#F5EBD0}4.167%{fill:#F7F2E6}5.556%{fill:#F9F6F1}6.944%{fill:#F1F4F8}8.333%{fill:#EDF2F8}9.722%{fill:#F2D8D8}11.111%{fill:#FAF1EB}12.5%{fill:#FBEFEA}13.889%{fill:#EAF0FB}15.278%{fill:#F5E3C4}16.667%{fill:#EAF2FA}18.056%{fill:#EEF5FC}19.444%{fill:#9EA5CF}20.833%{fill:#DEC8A4}22.222%{fill:#FBF1EA}23.611%{fill:#FBF0E9}25%{fill:#F9F5EC}26.389%{fill:#FDF1D6}27.778%{fill:#FBF2D4}29.167%{fill:#FDF4E8}30.556%{fill:#FDF5DE}31.944%{fill:#F9F3E7}33.333%{fill:#FDF5E6}34.722%{fill:#FBF1D4}36.111%{fill:#F8DD9F}37.5%{fill:#E3CB94}38.889%{fill:#B9D8EB}40.278%{fill:#F4DFBB}41.667%{fill:#E9C287}43.056%{fill:#ECD280}44.444%{fill:#F8F4ED}45.833%{fill:#E0B052}47.222%{fill:#E2C297}48.611%{fill:#E0C088}50%{fill:#F9F4EB}51.389%{fill:#FDF8ED}52.778%{fill:#FCF8EE}54.167%{fill:#F9F4EC}55.556%{fill:#FBF6E9}56.944%{fill:#F8F0DF}58.333%{fill:#FDF5D6}59.722%{fill:#FDF7E5}61.111%{fill:#FAF3EB}62.5%{fill:#FDF9ED}63.889%{fill:#F9F3EB}65.278%{fill:#FDF7ED}66.667%{fill:#F7F2DE}68.056%{fill:#FCF5EE}69.444%{fill:#F9EFD9}70.833%{fill:#FAEEDB}72.222%{fill:#FBF5E9}73.611%{fill:#F8EED2}75%{fill:#F8F1E0}76.389%{fill:#F9F4EB}77.778%{fill:#FDF3DE}79.167%{fill:#FAF4EB}80.556%{fill:#F8EFD9}81.944%{fill:#FCF7E9}83.333%{fill:#E8DDC3}84.722%{fill:#F6F3EE}86.111%{fill:#A0A3C3}87.5%{fill:#DEE0E1}88.889%{fill:#EDF3F8}90.278%{fill:#F0F2F4}91.667%{fill:#F7F6F2}93.056%{fill:#F8F4ED}94.444%{fill:#E7C099}95.833%{fill:#F7F6F2}97.222%{fill:#F2ECE2}98.611%{fill:#E3C09E}}'
    + '@keyframes mtn-sys-l3{0%,100%{fill:#F7DFC0}1.389%{fill:#DCE7F5}2.778%{fill:#EFE0B8}4.167%{fill:#F2E9D2}5.556%{fill:#F2ECDE}6.944%{fill:#DCE4F0}8.333%{fill:#FBF7EA}9.722%{fill:#EAC4C4}11.111%{fill:#F2D8C4}12.5%{fill:#F5D0C0}13.889%{fill:#CBDCF7}15.278%{fill:#869DE0}16.667%{fill:#E4EEFA}18.056%{fill:#DCEBFA}19.444%{fill:#7C8CD8}20.833%{fill:#E8C390}22.222%{fill:#F5D8C0}23.611%{fill:#F7D8C4}25%{fill:#EFE2C6}26.389%{fill:#FBE0A0}27.778%{fill:#F7E4A0}29.167%{fill:#FBE0B8}30.556%{fill:#FBE6A8}31.944%{fill:#F0DCB8}33.333%{fill:#FBE0B0}34.722%{fill:#F7E0A0}36.111%{fill:#ECC481}37.5%{fill:#E17447}38.889%{fill:#E0CEA5}40.278%{fill:#DDC7A0}41.667%{fill:#DCB08A}43.056%{fill:#E8C24C}44.444%{fill:#F5EFE2}45.833%{fill:#D2802C}47.222%{fill:#9BB8D5}48.611%{fill:#D2A860}50%{fill:#F0DEC0}51.389%{fill:#FBEAC8}52.778%{fill:#F5E4B8}54.167%{fill:#F2E6D0}55.556%{fill:#F7E7C0}56.944%{fill:#EFDAB0}58.333%{fill:#FBE8A0}59.722%{fill:#FAE6B0}61.111%{fill:#F2DCC0}62.5%{fill:#FAE8B8}63.889%{fill:#F0DCC0}65.278%{fill:#FBE6C4}66.667%{fill:#EDE0B0}68.056%{fill:#F5D8B8}69.444%{fill:#F2DCA8}70.833%{fill:#F5D8A8}72.222%{fill:#F7E4C0}73.611%{fill:#F2DCA0}75%{fill:#F0DCB0}76.389%{fill:#F0DEC0}77.778%{fill:#FAE0A8}79.167%{fill:#F2DEC0}80.556%{fill:#F0DCA8}81.944%{fill:#F7E6B8}83.333%{fill:#DBD1C2}84.722%{fill:#F2ECE2}86.111%{fill:#ED9B48}87.5%{fill:#E7E1D3}88.889%{fill:#ECF2F9}90.278%{fill:#E4E9EE}91.667%{fill:#EFEAE0}93.056%{fill:#F2E9D8}94.444%{fill:#96ABCF}95.833%{fill:#F0ECE2}97.222%{fill:#EAE2D2}98.611%{fill:#C0C0B4}}'
    + '@keyframes mtn-sys-l4{0%,100%{fill:#94BCDA}1.389%{fill:#9DB0C7}2.778%{fill:#C4C6CD}4.167%{fill:#ECE0CD}5.556%{fill:#CBC0E0}6.944%{fill:#C0D0E4}8.333%{fill:#F0E8D0}9.722%{fill:#E6ACAC}11.111%{fill:#D9946A}12.5%{fill:#E08868}13.889%{fill:#F7E4C8}15.278%{fill:#ECB75D}16.667%{fill:#B7D0F2}18.056%{fill:#5C93E0}19.444%{fill:#E8B460}20.833%{fill:#D2B078}22.222%{fill:#E0A088}23.611%{fill:#E88A6A}25%{fill:#E0783C}26.389%{fill:#DB6D3E}27.778%{fill:#E8B850}29.167%{fill:#E88C40}30.556%{fill:#E8B048}31.944%{fill:#D9AC70}33.333%{fill:#E8943C}34.722%{fill:#E0C048}36.111%{fill:#E8AE4D}37.5%{fill:#4A9BA8}38.889%{fill:#8BC0E1}40.278%{fill:#EEC989}41.667%{fill:#D2925C}43.056%{fill:#C9A468}44.444%{fill:#E8D4A0}45.833%{fill:#D99B21}47.222%{fill:#D9A868}48.611%{fill:#D9AA57}50%{fill:#E0A868}51.389%{fill:#E8A23C}52.778%{fill:#E8B23C}54.167%{fill:#D98E4A}55.556%{fill:#E0A85C}56.944%{fill:#D9A03C}58.333%{fill:#E8C24C}59.722%{fill:#E8B850}61.111%{fill:#E0A87A}62.5%{fill:#E0A85E}63.889%{fill:#D9A868}65.278%{fill:#E88C3C}66.667%{fill:#C9A852}68.056%{fill:#D9A468}69.444%{fill:#E0A048}70.833%{fill:#E07C3C}72.222%{fill:#D99A50}73.611%{fill:#D9A448}75%{fill:#D9A860}76.389%{fill:#D9A868}77.778%{fill:#E89438}79.167%{fill:#E5976F}80.556%{fill:#D9A448}81.944%{fill:#E0AC50}83.333%{fill:#BDC4CA}84.722%{fill:#D2C0A8}86.111%{fill:#7B7FB0}87.5%{fill:#E4DFD3}88.889%{fill:#DCE8F5}90.278%{fill:#D9A860}91.667%{fill:#D9C7A8}93.056%{fill:#D2A860}94.444%{fill:#6C8CC0}95.833%{fill:#D7C1A2}97.222%{fill:#E3D3B9}98.611%{fill:#D9A470}}'
    + '@keyframes mtn-sys-l5{0%,100%{fill:#85AACD}1.389%{fill:#B78592}2.778%{fill:#EDD89F}4.167%{fill:#E8D5A4}5.556%{fill:#AB97D1}6.944%{fill:#96B2D6}8.333%{fill:#CCDCEC}9.722%{fill:#4C74AC}11.111%{fill:#4ECFD5}12.5%{fill:#DC5C3B}13.889%{fill:#F2CC95}15.278%{fill:#3450DB}16.667%{fill:#8DB0E7}18.056%{fill:#E8A94D}19.444%{fill:#7581BF}20.833%{fill:#4C6C90}22.222%{fill:#D28E76}23.611%{fill:#CE6767}25%{fill:#40A6D2}26.389%{fill:#E8A430}27.778%{fill:#E05534}29.167%{fill:#44A8D3}30.556%{fill:#E04234}31.944%{fill:#50AED5}33.333%{fill:#DC703B}34.722%{fill:#E04A34}36.111%{fill:#524195}37.5%{fill:#D2531E}38.889%{fill:#D5B878}40.278%{fill:#D2B073}41.667%{fill:#48C0D2}43.056%{fill:#877C8A}44.444%{fill:#E1C16F}45.833%{fill:#425892}47.222%{fill:#B0602C}48.611%{fill:#5C6884}50%{fill:#D28455}51.389%{fill:#DC703B}52.778%{fill:#DD573B}54.167%{fill:#42BED3}55.556%{fill:#4BB3D5}56.944%{fill:#3DA4D1}58.333%{fill:#4899D4}59.722%{fill:#DC763B}61.111%{fill:#DA8A48}62.5%{fill:#D77B2F}63.889%{fill:#CB814F}65.278%{fill:#DA7741}66.667%{fill:#C87438}68.056%{fill:#4DBAD5}69.444%{fill:#44AFD3}70.833%{fill:#40C1D2}72.222%{fill:#44B5D3}73.611%{fill:#C68A23}75%{fill:#4AB0D5}76.389%{fill:#D38F36}77.778%{fill:#41B6D2}79.167%{fill:#D9A868}80.556%{fill:#41A6D3}81.944%{fill:#47A8D4}83.333%{fill:#DBC798}84.722%{fill:#C3A67F}86.111%{fill:#56598C}87.5%{fill:#E0DBCB}88.889%{fill:#CCD4DA}90.278%{fill:#8299B2}91.667%{fill:#C8AD92}93.056%{fill:#C89132}94.444%{fill:#4C6C90}95.833%{fill:#C9A878}97.222%{fill:#5C6C84}98.611%{fill:#C88850}}'
    + '@keyframes mtn-sys-l6{0%,100%{fill:#66A2D0}1.389%{fill:#7593B7}2.778%{fill:#A3A8B6}4.167%{fill:#B8C6D2}5.556%{fill:#A896D0}6.944%{fill:#D2B888}8.333%{fill:#F5EAC0}9.722%{fill:#445388}11.111%{fill:#BE7062}12.5%{fill:#DB6135}13.889%{fill:#6C93F5}15.278%{fill:#2B53CC}16.667%{fill:#85B1EC}18.056%{fill:#2873DC}19.444%{fill:#E89246}20.833%{fill:#415E98}22.222%{fill:#D97B57}23.611%{fill:#53AFD7}25%{fill:#CD3723}26.389%{fill:#3EA5D2}27.778%{fill:#E7A619}29.167%{fill:#C76F3B}30.556%{fill:#E19A17}31.944%{fill:#C27B56}33.333%{fill:#42A7D3}34.722%{fill:#2E99C6}36.111%{fill:#3B2E70}37.5%{fill:#BB1B1B}38.889%{fill:#5CA8D8}40.278%{fill:#C99944}41.667%{fill:#9C4832}43.056%{fill:#BC8C3D}44.444%{fill:#DFB26D}45.833%{fill:#B8401C}47.222%{fill:#9B5039}48.611%{fill:#445B88}50%{fill:#DB8E35}51.389%{fill:#D88814}52.778%{fill:#429FD3}54.167%{fill:#CC582B}55.556%{fill:#CE7F4D}56.944%{fill:#D34D2E}58.333%{fill:#E4B218}59.722%{fill:#E7A619}61.111%{fill:#C46E50}62.5%{fill:#DC8F2A}63.889%{fill:#D38F36}65.278%{fill:#D86F14}66.667%{fill:#2DADBF}68.056%{fill:#D38936}69.444%{fill:#D2861E}70.833%{fill:#D44D2A}72.222%{fill:#C97543}73.611%{fill:#A52A34}75%{fill:#D3902E}76.389%{fill:#CC582B}77.778%{fill:#D45228}79.167%{fill:#E0743C}80.556%{fill:#C68A23}81.944%{fill:#D89520}83.333%{fill:#C9B79C}84.722%{fill:#6888AA}86.111%{fill:#3E416C}87.5%{fill:#C0C4C8}88.889%{fill:#AECBEB}90.278%{fill:#D3902E}91.667%{fill:#CCAF7D}93.056%{fill:#1C3868}94.444%{fill:#35506F}95.833%{fill:#5C7CB0}97.222%{fill:#445B88}98.611%{fill:#AF6C31}}'
    + '@keyframes mtn-sys-l7{0%,100%{fill:#5A8FC0}1.389%{fill:#A65E70}2.778%{fill:#D2A860}4.167%{fill:#DEC8A2}5.556%{fill:#A08FC1}6.944%{fill:#B99877}8.333%{fill:#E5D4A3}9.722%{fill:#375989}11.111%{fill:#D27338}12.5%{fill:#2FC7B5}13.889%{fill:#336BF6}15.278%{fill:#1E3FA0}16.667%{fill:#5C8FE0}18.056%{fill:#E59218}19.444%{fill:#4C63D0}20.833%{fill:#35506F}22.222%{fill:#C86A48}23.611%{fill:#E56235}25%{fill:#C95B1B}26.389%{fill:#C15020}27.778%{fill:#2F99C6}29.167%{fill:#DB6F15}30.556%{fill:#3A8FB5}31.944%{fill:#D2933F}33.333%{fill:#D87814}34.722%{fill:#D2AC1E}36.111%{fill:#2B4272}37.5%{fill:#A31F1C}38.889%{fill:#D2661E}40.278%{fill:#6787A4}41.667%{fill:#8C4A28}43.056%{fill:#6C5E70}44.444%{fill:#73B493}45.833%{fill:#AC7916}47.222%{fill:#86471E}48.611%{fill:#424D66}50%{fill:#C1652E}51.389%{fill:#C1541E}52.778%{fill:#D89A14}54.167%{fill:#C77124}55.556%{fill:#DC9028}56.944%{fill:#BD8420}58.333%{fill:#CD3725}59.722%{fill:#2FB5C7}61.111%{fill:#34B0C1}62.5%{fill:#2DAFC1}63.889%{fill:#30B5C7}65.278%{fill:#C15A22}66.667%{fill:#B18E31}68.056%{fill:#C48442}69.444%{fill:#AC293E}70.833%{fill:#C95F1B}72.222%{fill:#CB7F26}73.611%{fill:#478359}75%{fill:#94593A}76.389%{fill:#2CAABB}77.778%{fill:#D57813}79.167%{fill:#40C1D2}80.556%{fill:#B7293D}81.944%{fill:#993B25}83.333%{fill:#9BA8B4}84.722%{fill:#B68C54}86.111%{fill:#3E3A63}87.5%{fill:#D6C9AC}88.889%{fill:#A0C8E2}90.278%{fill:#5C7CA0}91.667%{fill:#B8916A}93.056%{fill:#202E58}94.444%{fill:#40404C}95.833%{fill:#416093}97.222%{fill:#425066}98.611%{fill:#414B67}}'
    + '@keyframes mtn-sys-l8{0%,100%{fill:#3789C7}1.389%{fill:#4F76A5}2.778%{fill:#8188A0}4.167%{fill:#E0C174}5.556%{fill:#866BC3}6.944%{fill:#C7A15B}8.333%{fill:#DCC274}9.722%{fill:#2F3B65}11.111%{fill:#A85040}12.5%{fill:#C1401E}13.889%{fill:#0647EB}15.278%{fill:#13278C}16.667%{fill:#D9995C}18.056%{fill:#2B55B7}19.444%{fill:#4C5CB0}20.833%{fill:#2E4573}22.222%{fill:#40A2CD}23.611%{fill:#C23A3A}25%{fill:#A02818}26.389%{fill:#CE8812}27.778%{fill:#C23A1A}29.167%{fill:#A0562A}30.556%{fill:#C1281A}31.944%{fill:#A85E38}33.333%{fill:#C1541E}34.722%{fill:#C1301A}36.111%{fill:#251C4A}37.5%{fill:#8C1212}38.889%{fill:#A54D13}40.278%{fill:#4C6B87}41.667%{fill:#743322}43.056%{fill:#966D2B}44.444%{fill:#D89A3C}45.833%{fill:#2E406E}47.222%{fill:#743928}48.611%{fill:#2F4165}50%{fill:#1F847B}51.389%{fill:#3D5A80}52.778%{fill:#C23A1E}54.167%{fill:#A0431E}55.556%{fill:#B5622E}56.944%{fill:#A83A20}58.333%{fill:#A0281A}59.722%{fill:#C15A1E}61.111%{fill:#A85234}62.5%{fill:#B0601E}63.889%{fill:#B26430}65.278%{fill:#3E7C8A}66.667%{fill:#A05A28}68.056%{fill:#A0682E}69.444%{fill:#811C2C}70.833%{fill:#A83A1E}72.222%{fill:#A85A2C}73.611%{fill:#7A1C24}75%{fill:#6E4028}76.389%{fill:#A0431E}77.778%{fill:#A83E1C}79.167%{fill:#D38F36}80.556%{fill:#8C1C2C}81.944%{fill:#6E2818}83.333%{fill:#C97B4E}84.722%{fill:#4B6C8E}86.111%{fill:#282A4A}87.5%{fill:#CEC4A5}88.889%{fill:#AAB8C4}90.278%{fill:#2E3A4C}91.667%{fill:#C09750}93.056%{fill:#0F203D}94.444%{fill:#21354B}95.833%{fill:#2D466F}97.222%{fill:#2F4165}98.611%{fill:#865121}}'
    + '@keyframes mtn-sys-l9{0%,100%{fill:#2E6C9E}1.389%{fill:#2B6E73}2.778%{fill:#4AA9D2}4.167%{fill:#92ABC0}5.556%{fill:#8068B0}6.944%{fill:#A87C50}8.333%{fill:#5C8CC0}9.722%{fill:#243F64}11.111%{fill:#4A1E1C}12.5%{fill:#4A1810}13.889%{fill:#13318C}15.278%{fill:#0A185D}16.667%{fill:#2B7080}18.056%{fill:#1859B3}19.444%{fill:#E07516}20.833%{fill:#21354B}22.222%{fill:#6A2E1E}23.611%{fill:#4A1414}25%{fill:#3E0F0A}26.389%{fill:#481A0A}27.778%{fill:#481008}29.167%{fill:#3E200E}30.556%{fill:#480C0A}31.944%{fill:#5A3018}33.333%{fill:#481C0A}34.722%{fill:#400C08}36.111%{fill:#1A2A4B}37.5%{fill:#761311}38.889%{fill:#4D3A2B}40.278%{fill:#1B2C4C}41.667%{fill:#633219}43.056%{fill:#2A2438}44.444%{fill:#3A2418}45.833%{fill:#8A2D11}47.222%{fill:#5B2E11}48.611%{fill:#293246}50%{fill:#6B3018}51.389%{fill:#5A1F0E}52.778%{fill:#4A1408}54.167%{fill:#4A200E}55.556%{fill:#3A1D10}56.944%{fill:#401810}58.333%{fill:#3A0F0A}59.722%{fill:#501E0E}61.111%{fill:#401E14}62.5%{fill:#3E1B0C}63.889%{fill:#5A2E18}65.278%{fill:#4A200E}66.667%{fill:#402410}68.056%{fill:#3A1C0E}69.444%{fill:#380A10}70.833%{fill:#401810}72.222%{fill:#3E1E0E}73.611%{fill:#300A0E}75%{fill:#2E180C}76.389%{fill:#2E1810}77.778%{fill:#3A140C}79.167%{fill:#3A200E}80.556%{fill:#340A10}81.944%{fill:#2C0E08}83.333%{fill:#8B7B6E}84.722%{fill:#152238}86.111%{fill:#262342}87.5%{fill:#9FA8B0}88.889%{fill:#C86A3C}90.278%{fill:#181F2A}91.667%{fill:#1C2438}93.056%{fill:#101830}94.444%{fill:#25252F}95.833%{fill:#181818}97.222%{fill:#293546}98.611%{fill:#2A3146}}'
    + '@keyframes mtn-sys-l10{0%,100%{fill:#1E4F76}1.389%{fill:#1A494C}2.778%{fill:#C89132}4.167%{fill:#D2B076}5.556%{fill:#7FA358}6.944%{fill:#B38737}8.333%{fill:#3B70A9}9.722%{fill:#1C2440}11.111%{fill:#220D0C}12.5%{fill:#1D0905}13.889%{fill:#0B1F5C}15.278%{fill:#091845}16.667%{fill:#1B4D58}18.056%{fill:#1E3F8C}19.444%{fill:#2B44B9}20.833%{fill:#1C2C4C}22.222%{fill:#401A10}23.611%{fill:#1F0707}25%{fill:#160503}26.389%{fill:#170803}27.778%{fill:#170502}29.167%{fill:#150B04}30.556%{fill:#170303}31.944%{fill:#2F180B}33.333%{fill:#170903}34.722%{fill:#170402}36.111%{fill:#0A1222}37.5%{fill:#5C0A0A}38.889%{fill:#2A1F16}40.278%{fill:#0B1424}41.667%{fill:#4A1F14}43.056%{fill:#100D17}44.444%{fill:#130B07}45.833%{fill:#1C2848}47.222%{fill:#4C2418}48.611%{fill:#1C2840}50%{fill:#3F1B0C}51.389%{fill:#2A0E05}52.778%{fill:#180602}54.167%{fill:#1B0B04}55.556%{fill:#140A05}56.944%{fill:#150705}58.333%{fill:#160503}59.722%{fill:#210C05}61.111%{fill:#160A06}62.5%{fill:#160904}63.889%{fill:#2F170B}65.278%{fill:#1B0B04}66.667%{fill:#150B05}68.056%{fill:#150A04}69.444%{fill:#160306}70.833%{fill:#150705}72.222%{fill:#150A04}73.611%{fill:#160406}75%{fill:#150A05}76.389%{fill:#130A06}77.778%{fill:#160704}79.167%{fill:#150B04}80.556%{fill:#160406}81.944%{fill:#160703}83.333%{fill:#705F51}84.722%{fill:#060B13}86.111%{fill:#100F1E}87.5%{fill:#D7A83E}88.889%{fill:#5E81A0}90.278%{fill:#090C11}91.667%{fill:#090C13}93.056%{fill:#040B15}94.444%{fill:#0C0C10}95.833%{fill:#0D0C0C}97.222%{fill:#1C2840}98.611%{fill:#141824}}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    /* fill is a PAINT property: animating it forces a full re-raster of these huge ridge
       textures, so it must not interpolate continuously. Each palette stop gets a HOLD
       keyframe injected just before the next stop (see holdify() below): the colour
       stays perfectly still for ~3.6s of its 4s slot, then crossfades to the next stop
       over the last ~0.4s. Repaints happen only inside that brief crossfade window —
       no per-frame re-raster, and no hard steps() flash at the boundary.
       translate flows stay GPU-composited regardless.
       --mtn-phase offsets the shared palette clock so a fresh page load opens mid-cycle
       inside the Terracotta Canyon band; hosts may override it on
       .mtn-bg (e.g. style="--mtn-phase:-52s" opens on Harbour Dusk). */
    + '.mtn-bg .fill{animation-iteration-count:infinite;animation-timing-function:linear}'
    + '.mtn-bg [class^="flow-"]{will-change:transform}'
    + '.mtn-bg .cloud-bob{animation:mtn-cloud-bob 8s ease-in-out infinite}'
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(0,0,0,0.24);stroke-width:1.2}'
    /* LINE-ART mode — add class "line-art" to .mtn-bg. The filled ridges drop
       out and only the contour lines remain: a clean topographic line-drawing
       of the range, so text pages keep the living, moving backdrop without any
       coloured wash competing with the words. The palette rotation still runs
       underneath — a colour layer can fade in over this on chosen moments. */
    + '.mtn-bg.line-art .fill{opacity:0;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg.line-art [clip-path]>use{opacity:0;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg.line-art .contour use,.mtn-bg.line-art .cloud-contour use{stroke:rgba(42,32,22,0.34);stroke-width:1.1}'
    /* ENTRANCE FLOOD — on page arrival the range pours up into place. init()
       holds line-art off for a beat so the coloured ridges surge in, then adds
       line-art so the colour recedes and leaves the line-drawing: background
       floods in, then fades to rest. Transform-only sweep = GPU cheap. */
    + '.mtn-bg.mtn-enter{animation:mtn-enter 1.15s cubic-bezier(.16,1,.3,1) both}'
    + '@keyframes mtn-enter{from{transform:translateY(38px) scale(1.06)}to{transform:none}}'
    + '.mtn-bg .l1{animation-name:mtn-sys-l1;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.48}'
    + '.mtn-bg .l2{animation-name:mtn-sys-l2;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.60}'
    + '.mtn-bg .l3{animation-name:mtn-sys-l3;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.72}'
    + '.mtn-bg .l4{animation-name:mtn-sys-l4;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.83}'
    + '.mtn-bg .l5{animation-name:mtn-sys-l5;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.90}'
    + '.mtn-bg .l6{animation-name:mtn-sys-l6;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.95}'
    + '.mtn-bg .l7{animation-name:mtn-sys-l7;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:.97}'
    + '.mtn-bg .l8{animation-name:mtn-sys-l8;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .l9{animation-name:mtn-sys-l9;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .l10{animation-name:mtn-sys-l10;animation-duration:1440s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .flow-1{animation:mtn-flow-l 145s linear infinite}.mtn-bg .flow-2{animation:mtn-flow-r 128s linear infinite}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 112s linear infinite}.mtn-bg .flow-4{animation:mtn-flow-r 96s linear infinite}'
    + '.mtn-bg .flow-5{animation:mtn-flow-l 82s linear infinite}.mtn-bg .flow-6{animation:mtn-flow-r 70s linear infinite}'
    + '.mtn-bg .flow-7{animation:mtn-flow-l 58s linear infinite}.mtn-bg .flow-8{animation:mtn-flow-r 48s linear infinite}'
    + '.mtn-bg .flow-9{animation:mtn-flow-l 40s linear infinite}.mtn-bg .flow-10{animation:mtn-flow-r 32s linear infinite}'
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 120s linear infinite}.mtn-bg .cloud-2{animation:mtn-cloud-l 96s linear infinite}'
    + '.mtn-bg .cloud-3{animation:mtn-cloud-r 74s linear -30s infinite}.mtn-bg .cloud-4{animation:mtn-cloud-l 132s linear -18s infinite}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 104s linear -50s infinite}.mtn-bg .cloud-6{animation:mtn-cloud-l 84s linear -12s infinite}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use{animation:none!important}}';

  /* holdify — rewrite every mtn-sys-l* keyframe list from evenly-spaced stops into
     hold-then-blend pairs: before each stop, insert a keyframe 0.5% (~1s) earlier
     carrying the PREVIOUS colour. Between a stop and its inserted twin the value is
     constant (zero repaint); the short window to the next stop crossfades smoothly.
     Kills both the per-frame re-raster and the hard flash at palette boundaries. */
  var HOLD = 0.07;
  CSS = CSS.replace(/@keyframes (mtn-sys-l\d+)\{((?:[^{}]+\{[^{}]*\})+)\}/g, function (m, name, body) {
    var stops = [];
    body.replace(/([\d.,%]+)\{fill:(#[0-9A-Fa-f]+)\}/g, function (mm, sel, col) {
      stops.push({ sel: sel, p: parseFloat(sel), c: col });
      return mm;
    });
    if (!stops.length) return m;
    var out = '';
    for (var i = 0; i < stops.length; i++) {
      if (i > 0) out += (stops[i].p - HOLD).toFixed(3) + '%{fill:' + stops[i - 1].c + '}';
      out += stops[i].sel + '{fill:' + stops[i].c + '}';
    }
    out += (100 - HOLD).toFixed(3) + '%{fill:' + stops[stops.length - 1].c + '}';
    return '@keyframes ' + name + '{' + out + '}';
  });

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
      /* fill and contours ride in SEPARATE flow groups sharing the same animation
         (same timeline + start = always in sync). The fill layer re-rasters at each
         4s palette step; the ~100 stroked contour paths now sit in their own cached
         composited layers and are never re-stroked. */
      ridges += '<g class="flow-' + i + '"><use href="#mw' + i + '" class="fill l' + i + '"/></g>'
        + '<g class="flow-' + i + '"><g class="contour">' + contour + '</g></g>';
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
    var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    document.querySelectorAll('.mtn-bg').forEach(function (el) {
      /* random palette starting point per page load (host may still pin --mtn-phase) */
      if (!el.style.getPropertyValue('--mtn-phase')) {
        el.style.setProperty('--mtn-phase', '-' + (Math.random() * 1440).toFixed(1) + 's');
      }
      if (!el.firstElementChild) el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
      });

      /* entrance flood: on a line-art backdrop, hold the line-art off for a
         beat so the coloured ridges pour in, then restore it so the colour
         fades to the resting line-drawing. Pure enhancement; reduced-motion
         and no-JS keep the static line-art the HTML already declares. */
      if (!reduce && el.classList.contains('line-art')) {
        el.classList.remove('line-art');
        el.classList.add('mtn-enter');
        setTimeout(function () { el.classList.add('line-art'); }, 760);
        setTimeout(function () { el.classList.remove('mtn-enter'); }, 1200);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
