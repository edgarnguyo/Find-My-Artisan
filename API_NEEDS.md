# API Needs Statements — Week 2 Lab
Team Name- Group 1
Ian Chogo
Edgar Nguyo
Cedric Ngari

Repo: https://github.com/edgarnguyo/Find-My-Artisan.git
## Team 13 — needs from upstream partner

| #   | Needs statement                                                                                                   | Freshness                        | Volume             | Auth              |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------ | ----------------- |
| 1   | Team 13 needs to find the location of second-hand items in order to provide artisans with raw materials for jobs. | Real-time                        | Once per page load | No authentication |
| 2   | Team 13 needs cost information on raw materials in order to supply artisans (accountability).                     | Real-time                        | Constantly         | No authentication |
| 3   | Team 13 needs filtered access to raw materials/goods in order to supply our artisans.                             | Real-time                        | Constantly         | No authentication |
| 4   | Team 13 needs a website feature that lets users on our platform log scrap after a job has been completed.         | Updated (not strictly real-time) | Once per page load | No authentication |

## Meditrac (Team 2) — needs from our API (downstream partner)

| #   | Needs statement                                                                                                  | Freshness | Volume        | Auth              |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------- | ------------- | ----------------- |
| 1   | Meditrac needs data on our artisans to source artisans in order to carry out blue-collar jobs at their pharmacies. | Real-time | Per page load | No authentication |
| 2   | Meditrac needs our API to book artisans in order to carry out future jobs at their pharmacies.                     | Real-time | Per page load | No authentication |
| 3   | Meditrac needs our API to vet artisans in order to determine who can carry out tasks at their pharmacies.          | Real-time | Per page load | No authentication |
| 4   | Meditrac needs our API to schedule artisans in order to carry out maintenance jobs.                                | Real-time | Per page load | No authentication |


> Correction: earlier versions labelled our downstream partner "Team 1". Team 1 is us
> (Find My Artisan); the downstream partner is Meditrac (Team 2).

## Part E — check against the Week 1 audit

| Meditrac need | Covered by Week 1 audit (`TEAM_CHARTER.md`)? | Note |
| --- | --- | --- |
| 1. Source artisans | Yes — artisan name, skills, location | |
| 2. Book artisans | Partly — job information exists, but no contact detail for the artisan | Gap: the audit stores no artisan phone number. Added to the contract as `phone` |
| 3. Vet artisans | No | Gap: the audit stores no verification or certificate data. Added to the contract as `verified` + `verification` |
| 4. Schedule artisans | Yes — artisan availability | Kept simple as `availableToday` |

## Reflection

<!-- TODO (team): a short, honest paragraph on what the interviews changed about what you
planned to build. The handout grades this as your own reflection, so write it yourselves. -->
