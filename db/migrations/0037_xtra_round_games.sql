-- Aaron is co-owner of Xtra Round Games with Jeff Steele (his words, 2026-11-13). Added to his bio once,
-- and as a small editable line under the games on the Video Games page.
UPDATE creators SET bio = bio || ' Aaron is also co-owner, with Jeff Steele, of [Xtra Round Games](https://xtra-round-games.com/), a Davis studio making AR games you play with friends on your phone.' WHERE name = 'Aaron Wedra' AND instr(bio, 'Xtra Round') = 0;
INSERT OR IGNORE INTO blocks(key,label,kind,value,page,sort) VALUES('arcade_more','Video games: small line under the games (leave empty to hide)','text','More AR from the same table: Aaron co-owns [Xtra Round Games](https://xtra-round-games.com/) with Jeff Steele.','home',60);
