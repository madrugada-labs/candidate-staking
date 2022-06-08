use crate::{ApplicationParameter, JobStatus};
use anchor_lang::prelude::ErrorCode;

use std::cmp::{max, min};

/// RewardCalculator is a utility wrapper type that contains
/// the application parameters and yields how much will be paid
/// corresponding to each tier in case the candidate is selected
/// given that the staker is staking at this point in time.
///
/// Note that for simplicity we're not allowing to stake if the amount
/// to be staked exceeds the available amount to stake.

pub struct RewardCalculator<'a> {
    application_parameters: &'a ApplicationParameter,
}

impl<'a> RewardCalculator<'a> {
    pub fn calculate_reward(&self, k: u32) -> Result<(u32, u32, u32), ErrorCode> {
        // for simplicity -> k: amount_pledged_to_stake
        let mut k = k;
        let w = self.application_parameters.staked_amount;
        let max_allowed_staked = self.application_parameters.max_allowed_staked;

        let available_amount_to_stake = max_allowed_staked - w;
        if self.application_parameters.status != JobStatus::Pending || k > available_amount_to_stake
        {
            // TODO: return a custom created error
            return Err(ErrorCode::RequireViolated);
        }

        let k_tier_1 = min(
            k,
            min(
                max_allowed_staked / 3,
                max(0, (max_allowed_staked * 1 / 3).saturating_sub(w)),
            ),
        );
        k = k.saturating_sub(k_tier_1);

        let k_tier_2 = min(
            k,
            min(
                max_allowed_staked / 3,
                max(0, (max_allowed_staked * 2 / 3).saturating_sub(w)),
            ),
        );
        k = k.saturating_sub(k_tier_2);

        let k_tier_3 = max(
            k,
            min(
                k,
                min(
                    max_allowed_staked / 3,
                    max(0, (max_allowed_staked * 3 / 3).saturating_sub(w)),
                ),
            ),
        );
        k = k.saturating_sub(k_tier_3);

        let a = 3;
        let b = 2;
        let c = 1;
        Ok((k_tier_1 * a, k_tier_2 * b, k_tier_3 * c))
    }
}

#[cfg(test)]
mod test {
    use anchor_lang::prelude::Pubkey;

    use crate::JobStatus;

    use super::*;

    fn new_application_parameters(
        staked_amount: u32,
        max_allowed_staked: u32,
    ) -> ApplicationParameter {
        ApplicationParameter {
            authority: Pubkey::new_from_array([0; 32]),
            status: JobStatus::Pending,
            staked_amount,
            max_allowed_staked,
        }
    }

    #[test]
    fn calculate_reward_tier_one_only() {
        let application_parameters = new_application_parameters(0, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(reward_calculator.calculate_reward(10).unwrap(), (30, 0, 0));
    }

    #[test]
    fn calculate_reward_tier_two_only() {
        let application_parameters = new_application_parameters(33, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(reward_calculator.calculate_reward(10).unwrap(), (0, 20, 0));
    }

    #[test]
    fn calculate_reward_tier_three_only() {
        let application_parameters = new_application_parameters(66, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(reward_calculator.calculate_reward(10).unwrap(), (0, 0, 10));
    }

    #[test]
    fn calculate_reward_tier_one_and_two() {
        let application_parameters = new_application_parameters(0, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(reward_calculator.calculate_reward(40).unwrap(), (99, 14, 0));
    }

    #[test]
    fn calculate_reward_tier_two_and_three() {
        let application_parameters = new_application_parameters(50, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(reward_calculator.calculate_reward(40).unwrap(), (0, 32, 24));
    }

    #[test]
    fn calculate_reward_three_tiers_only() {
        let application_parameters = new_application_parameters(0, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        assert_eq!(
            reward_calculator.calculate_reward(100).unwrap(),
            (99, 66, 34)
        );
    }

    #[test]
    fn calculate_reward_not_staking_capacity() {
        let application_parameters = new_application_parameters(80, 100);
        let reward_calculator = RewardCalculator {
            application_parameters: &application_parameters,
        };
        // there's capacity for 20
        assert!(reward_calculator.calculate_reward(20).is_ok());
        assert!(reward_calculator.calculate_reward(21).is_err());
    }
}
