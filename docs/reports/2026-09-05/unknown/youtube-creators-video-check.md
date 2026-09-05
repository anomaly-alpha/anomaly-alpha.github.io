# YouTube Creator Video Check

Checked: 2026-09-05

## Scope and method

The repository source was compared against first-party YouTube Atom feeds for creators whose channel IDs could be resolved. The source currently contains 131 video IDs and has updated 2026-09-04. A video is treated as a candidate only when its feed entry is not already in the source; eligibility still requires a direct page review for GTG relevance, title, date, public standard-video or replayable-livestream format, and evidence. Shorts are excluded.

Resolved feeds checked:

- Avatar Shuvd: https://www.youtube.com/feeds/videos.xml?channel_id=UCmhqLp5THAKvldNDO0a1NWw
- Tutaaa-GTG: https://www.youtube.com/feeds/videos.xml?channel_id=UCMmKlikOnlwSlJETd7BVixw
- TH3O: https://www.youtube.com/feeds/videos.xml?channel_id=UCMQhyVbKHF97HiQYt9pwJgA
- OMNI-BANE: https://www.youtube.com/feeds/videos.xml?channel_id=UC7C8cCP4gdyTULBkZZyVGiQ
- Just a Guy named Francis: https://www.youtube.com/feeds/videos.xml?channel_id=UCJqFBhPxl1e0OvTyUo503LA
- INVINCIBLE GTG OMNI-FAN: https://www.youtube.com/feeds/videos.xml?channel_id=UCUlssVj4OfQwbuyBkpCmkOA
- Gxlden: https://www.youtube.com/feeds/videos.xml?channel_id=UCqMtiju2fBNalh-u0j5zKiA
- LAVAMOOSE: https://www.youtube.com/feeds/videos.xml?channel_id=UCr4L3RRjIpKSCC7aaFWosKQ
- KingSlay727: https://www.youtube.com/feeds/videos.xml?channel_id=UCTWNwUOlYOlme4NiJUbkZ1Q

## Clear missing candidates

These entries are absent from data/youtube-creators.json and have titles that clearly identify Invincible: Guarding the Globe coverage. They still need a direct page check for final evidence before being added.

| Creator | Published UTC | Video | Title |
|---|---|---|---|
| Avatar Shuvd | 2026-09-03 | https://www.youtube.com/watch?v=xT5lSyRPiqY | 20 SHOPS!? - Invincible: Guarding the Globe |
| Avatar Shuvd | 2026-09-02 | https://www.youtube.com/watch?v=Xk0irGBsyx4 | IMPROVED Boss Raid Returns! - Invincible: Guarding the Globe |
| Avatar Shuvd | 2026-09-01 | https://www.youtube.com/watch?v=dXG8h5h3pfI | LEGENDARY Triple Event Returns! - Invincible: Guarding the Globe |
| Avatar Shuvd | 2026-08-31 | https://www.youtube.com/watch?v=u9omBhW9Dpg | Wait, This Event is GOOD!? - Invincible: Guarding the Globe |
| Avatar Shuvd | 2026-08-29 | https://www.youtube.com/watch?v=nM7SPDZhjzw | One Thing SAVES This Event! - Invincible: Guarding the Globe |
| Avatar Shuvd | 2026-08-28 | https://www.youtube.com/watch?v=k3jdh4STxMM | HUGE SUBSOIL DEFENDER!? Armored Damien Review! - Invincible: Guarding the Globe |
| Tutaaa-GTG | 2026-09-05 | https://www.youtube.com/watch?v=zXQuufSmxUU | WE HAVE TO TALK ABOUT THIS MODE... Invincible Guarding The Globe - TutaaaGTG |
| OMNI-BANE | 2026-08-31 | https://www.youtube.com/watch?v=06upXNh41R0 | Invincible Guarding The Globe- Triple Pick Event!! |
| OMNI-BANE | 2026-08-28 | https://www.youtube.com/watch?v=fvFDH5i2E8Y | Invincible Guarding The Globe Fresh Recruit Event!!! |
| INVINCIBLE GTG OMNI-FAN | 2026-08-28 | https://www.youtube.com/watch?v=l0CHsWcE3mY | New Event! Fresh Recruits Event on INVINCIBLE: Guarding The Globe |
| LAVAMOOSE | 2026-08-31 | https://www.youtube.com/watch?v=_8VqAmjI_hg | The Entire Second Season Part 2 || Invincible Guarding The Globe |
| KingSlay727 | 2026-09-04 | https://www.youtube.com/watch?v=buXNXHGQXLc | INVINCABLE GTG JUST CHATTING |

## Candidates needing page review

These are absent from the source and appear in the creator feeds, but their titles alone do not establish enough GTG context or format for automatic promotion.

| Creator | Published UTC | Video | Title |
|---|---|---|---|
| Avatar Shuvd | 2026-08-29 | https://www.youtube.com/watch?v=UMTrljq1LXg | We want Brits and Damiens! |
| Avatar Shuvd | 2026-08-27 | https://www.youtube.com/watch?v=yj9OUVmNHWk | Summoning on the New Event! |
| KingSlay727 | 2026-09-02 | https://www.youtube.com/watch?v=pl0aMn9W_Ac | FRESH NEW RECRUITS WAS PEAK |
| KingSlay727 | 2026-09-02 | https://www.youtube.com/watch?v=pwWj4P_vyRg | TRIPLE PICK EVENT AND RANK UPS |
| KingSlay727 | 2026-08-31 | https://www.youtube.com/watch?v=FI0jUj1PVFg | NEW FREASH RECRUITS EVENT |
| KingSlay727 | 2026-08-30 | https://www.youtube.com/watch?v=v1QdJgilGMM | NEW (V3.5.9) TOTEM TIER LIST |
| KingSlay727 | 2026-08-30 | https://www.youtube.com/watch?v=r1vCJzO8784 | New (V3.5.9) Artifact Tier List |
| KingSlay727 | 2026-08-30 | https://www.youtube.com/watch?v=Xhi4f_Hka2w | NEW (V3.5.9) HERO TIER LIST |
| KingSlay727 | 2026-08-26 | https://www.youtube.com/watch?v=IHCRs2pVfOQ | NEW BLACK MARKET EVENT |

Older missing GTG entries also appeared in the feeds, including LAVAMOOSE video PlF_Q78Igp4 (2026-08-23) and OMNI-BANE video S9q2aQYT_5w (2026-08-24). They are not new since the source review date but are absent from the current source and should be considered during the same page review.

## Excluded feed entries

- Avatar Shuvd entries SAn8zzNo4AY, yLTglFqHHUQ, rPlrB1ETnBE, and c5JBXfX8ixM are RAID or unrelated sponsored-game content, not GTG coverage.
- Avatar Shuvd entry 5xefeUKfoMk is a YouTube Short.
- Tutaaa-GTG entry KlPxw481dEc is a YouTube Short.
- OMNI-BANE entries for DC Worlds Collide are unrelated to GTG.
- Gxlden entries surfaced in the checked window were either already known or unrelated/Short content.
- TH3O, Francis, and the resolved feeds for AlexanderGZMN and Gotcha Beast produced no confirmed missing recent GTG candidate in the checked window.

## Unresolved channels

RapidGTG, HeroHavenGTG, Subsktro, XGamersAsylum, PopsMeta, and the hidden Beaoloooo record could not be resolved to a reliable current Atom feed in this pass. Their channel URLs remain in data/youtube-creators.json and need manual channel-page review or channel-ID resolution.

## Conclusion

The prior September refresh did not add videos, but the live feed comparison shows that this reflects the committed data state rather than creator inactivity. At least 12 clear candidates are missing from the source, with additional ambiguous KingSlay727 and Avatar Shuvd candidates requiring page-level verification. No source or generated files were modified during this check.
