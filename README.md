# Dorse candidate staking smart contract

`candidate-staking` is a smart contract written using [Anchor](https://github.com/coral-xyz/anchor)
targeting Solana. The main idea is to allow `stakers` to flag interest in a candidate. This is a very
simple, yet effective, way to uncover key insights that are currently idle in the market due to a lack
of incentives for the right parties to reveal them.

## How does staking work?

Any user on [dorse.io](https://dorse.io) can create a staking profile by connecting their Solana wallet.
By doing so, they will be able to stake on every application that has been created on the platform.

Staking means that the user _locks_ funds for a specific period. When the company decides to hire a candidate,
those that have accurately staked will get a reward while those who did not bet on the right horse,
will just get their money back.

### When do you pay the rewards?

Typically a job is listed for at least one month. During that time, candidates will apply and companies will
be monitoring applications and following the recruiting process. Once they decide to make an offer, it's up
to the candidate to accept it.

Right after the candidate starts, there are 90 days of grace period where the company and the candidate will
get to know each other and ensure that everything is as they expected to be. After that, Dorse gets paid, and
that's the time when rewards are paid to stakers.

## Rewards

The detail on how the rewards are calculated can be checked [here](https://github.com/madrugada-labs/candidate-staking/blob/5c553fa8018d4d049109bc17a6b1b3e266f471a8/programs/application/src/reward_calculator.rs#L25). However, for the less technically interested user, these is the way it works:

Order matters in this case. The idea is that the ones who stake the first amounts will be rewarded more than
those that come later to the party.

For now this is done in a simple matter, and it's subjected to change:

- there are three tiers
- there is a total amount allowed to stake
- the total amount is split evenly in three tiers
- the first tier pays 3x what is staked in that chunk
- the second tier pays 2x
- the third tier pays 1.5x

All in all, if the staking pool is _filled_, the expected return is:

```
AMOUNT_ALLWED_TO_STAKE + 2/3 AMOUNT_ALLWED_TO_STAKE + AMOUNT_ALLWED_TO_STAKE/2 =
AMOUNT_ALLWED_TO_STAKE (1 + 2/3 + 1/2) =
AMOUNT_ALLWED_TO_STAKE (6/6 + 4/6 + 3/6) =
AMOUNT_ALLWED_TO_STAKE (13/6)
```

That's a **~2.16x expected return**!

## Smart contract architecture

TODO: Dhruv
