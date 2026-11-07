#![no_std]

// Example contract for the Kuyfi CI demo. Testnet only, no real funds, not
// third-party code. It splits an amount evenly into a number of parts.
//
// Two builds of the SAME source:
//   default                 -> a zero number of parts is a clean contract
//                              error (Error::ZeroParts).
//   --features vulnerable   -> the divisor is built with `new_unchecked`
//                              without validating it, so `parts = 0` divides
//                              by zero and the VM traps instead of returning
//                              an error: an uncontrolled panic.

use core::num::NonZeroU32;
use soroban_sdk::{contract, contracterror, contractimpl, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ZeroParts = 1,
}

#[contract]
pub struct Splitter;

#[contractimpl]
impl Splitter {
    /// Each part's share of `total` when split into `parts` equal parts.
    pub fn share(_env: Env, total: u32, parts: u32) -> Result<u32, Error> {
        Ok(total / divisor(parts)?)
    }

    /// Contract version (no parameters).
    pub fn version(_env: Env) -> u32 {
        1
    }
}

/// Safe build: validates the divisor.
#[cfg(not(feature = "vulnerable"))]
fn divisor(parts: u32) -> Result<NonZeroU32, Error> {
    NonZeroU32::new(parts).ok_or(Error::ZeroParts)
}

/// VULNERABLE BUILD: nothing checked `parts`, yet it is promised non-zero.
#[cfg(feature = "vulnerable")]
fn divisor(parts: u32) -> Result<NonZeroU32, Error> {
    // WRONG ON PURPOSE: the caller controls `parts` and can pass 0.
    Ok(unsafe { NonZeroU32::new_unchecked(parts) })
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn splits_evenly() {
        let env = Env::default();
        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        assert_eq!(client.share(&10, &2), 5);
        assert_eq!(client.version(), 1);
    }

    #[cfg(not(feature = "vulnerable"))]
    #[test]
    fn zero_parts_is_a_clean_error() {
        let env = Env::default();
        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        assert_eq!(client.try_share(&10, &0), Err(Ok(Error::ZeroParts)));
    }
}
