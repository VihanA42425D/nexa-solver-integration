// SPDX-License-Identifier: MIT
// @scope production-only
pragma solidity ^0.8.26;

/// @notice Minimal read-only interface required for public Nexa V6 route discovery.
interface INexaSolverRegistryV6 {
    struct RouteIdentity {
        bytes32 routeId;
        bytes32 sourceNetworkId;
        bytes32 sourceAssetId;
        bytes32 destinationNetworkId;
        bytes32 destinationAssetId;
    }

    function releaseId() external pure returns (bytes32);
    function routeCount() external view returns (uint256);
    function routeAt(uint256 index) external view returns (bytes32);
    function getRoute(bytes32 routeId) external view returns (RouteIdentity memory);
    function executionGeneration(bytes32 routeId) external view returns (bytes32);
    function routeStatus(bytes32 routeId) external view returns (uint8);
    function isRouteExecutable(bytes32 routeId) external view returns (bool);
}

/// @notice Minimal read-only interface required to verify the public execution target.
interface INexaSolverRouterV6 {
    function releaseId() external pure returns (bytes32);
    function registry() external view returns (address);
    function sourceIntakeEnabled() external view returns (bool);
}

/// @notice Small, read-only and source-verifiable public discovery facade.
contract NexaSolverDiscoveryV6 {
    bytes32 public constant RELEASE_ID = keccak256("NEXA_MAINNET_V6");
    uint256 public constant DEPLOYMENT_VERSION = 6;

    address public immutable registry;
    address public immutable router;

    error InvalidPublicDiscoveryConfiguration();

    constructor(address registryAddress, address routerAddress) {
        if (registryAddress == address(0) || routerAddress == address(0)) {
            revert InvalidPublicDiscoveryConfiguration();
        }
        registry = registryAddress;
        router = routerAddress;
    }

    function chainId() external view returns (uint256) {
        return block.chainid;
    }

    /// @notice Canonical offchain discovery document for this onchain facade.
    function discoveryURI() external pure returns (string memory) {
        return "https://solver.vsnexa.com/.well-known/nexa-solver.json";
    }

    function isLive() public view returns (bool) {
        try INexaSolverRegistryV6(registry).releaseId() returns (bytes32 registryRelease) {
            if (registryRelease != RELEASE_ID) return false;
        } catch {
            return false;
        }
        try INexaSolverRouterV6(router).releaseId() returns (bytes32 routerRelease) {
            if (routerRelease != RELEASE_ID) return false;
        } catch {
            return false;
        }
        try INexaSolverRouterV6(router).registry() returns (address boundRegistry) {
            if (boundRegistry != registry) return false;
        } catch {
            return false;
        }
        try INexaSolverRouterV6(router).sourceIntakeEnabled() returns (bool enabled) {
            if (!enabled) return false;
        } catch {
            return false;
        }
        return true;
    }

    function systemState()
        external
        view
        returns (
            uint256 currentChainId,
            bytes32 release,
            address publicRegistry,
            address publicRouter,
            uint256 discoverableRouteCount,
            bool live
        )
    {
        return (
            block.chainid,
            RELEASE_ID,
            registry,
            router,
            INexaSolverRegistryV6(registry).routeCount(),
            isLive()
        );
    }

    function routeCount() external view returns (uint256) {
        return INexaSolverRegistryV6(registry).routeCount();
    }

    function routeAt(uint256 index) external view returns (bytes32) {
        return INexaSolverRegistryV6(registry).routeAt(index);
    }

    function route(bytes32 routeId)
        external
        view
        returns (
            bytes32 sourceNetworkId,
            bytes32 sourceAssetId,
            bytes32 destinationNetworkId,
            bytes32 destinationAssetId,
            bytes32 executionGeneration,
            uint8 status,
            bool executable
        )
    {
        INexaSolverRegistryV6.RouteIdentity memory identity = INexaSolverRegistryV6(registry).getRoute(routeId);
        if (identity.routeId != routeId) revert InvalidPublicDiscoveryConfiguration();
        return (
            identity.sourceNetworkId,
            identity.sourceAssetId,
            identity.destinationNetworkId,
            identity.destinationAssetId,
            INexaSolverRegistryV6(registry).executionGeneration(routeId),
            INexaSolverRegistryV6(registry).routeStatus(routeId),
            INexaSolverRegistryV6(registry).isRouteExecutable(routeId)
        );
    }
}
