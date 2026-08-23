pub mod nexa {
    pub mod v6 {
        include!(concat!(env!("OUT_DIR"), "/nexa.v6.rs"));
    }
}

pub use nexa::v6::*;
