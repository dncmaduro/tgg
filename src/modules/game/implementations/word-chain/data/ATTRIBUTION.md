# Nguồn dữ liệu Nối Từ

MiniPlay bundles `nguoi_choi.txt` and `tu_cam.txt` from:

- Repository: https://github.com/banhmi-collab/noi-tu-tieng-viet
- Source commit: `1f74a02589082e35f8e19220ff5c1cd5f65920e7`
- Upstream source: Vietnamese Wiktionary, https://vi.wiktionary.org/
- License for the bundled data: CC BY-SA 4.0

The bundled lists are used offline and are not uploaded to Redis or sent to
the browser. MiniPlay ports the upstream `cong_cu/chuan_hoa.js` normalization
rules in `normalization.ts`; the upstream helper is retained as
`chuan_hoa.upstream.js` for auditability. The upstream helper is MIT licensed.

The data was adapted by retaining the two-syllable player list and blocked
word list from the pinned source commit. No AI-generated words are added.
