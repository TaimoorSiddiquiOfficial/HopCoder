/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { IhopcoderUpdateService } from '../common/hopcoderUpdateService.js';
import { VoidCheckUpdateRespose } from '../common/hopcoderUpdateServiceTypes.js';
import { isLinux } from '../../../../base/common/platform.js';


export class VoidMainUpdateService extends Disposable implements IhopcoderUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
	) {
		super()
	}


	async check(explicit: boolean): Promise<VoidCheckUpdateRespose> {
		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		if (isDevMode) {
			return { message: null } as const
		}

		if (isLinux) {
			return this._manualCheckGHTagIfDisabled(explicit)
		}

		// if (isDev) return { message: 'Dev mode: no updates.', action: 'upToDate' } as const

		await this._updateService.checkForUpdates(explicit)
		const state = this._updateService.state

		if (state.type === StateType.Idle) {
			if (explicit)
				return { message: 'HopCoder is up-to-date!' } as const
			return { message: null } as const
		}
		else if (state.type === StateType.AvailableForDownload || state.type === StateType.Downloaded || state.type === StateType.Ready) {
			return { message: 'Restart HopCoder to update!', action: 'restart' } as const
		}

		return { message: null } as const

	}


	// linux doesn't support auto-update, so we just check the latest tag on github
	private async _manualCheckGHTagIfDisabled(explicit: boolean): Promise<VoidCheckUpdateRespose> {
		try {
			const response = await fetch('https://api.github.com/repos/TaimoorSiddiquiOfficial/HopCoder/releases/latest');
			const data = await response.json() as any;
			const latestVersion = data.tag_name;

			const currentVersion = this._productService.voidVersion;

			if (latestVersion !== currentVersion) {
				// if (explicit)
				// 	return { message: `Update available: ${latestVersion}`, action: 'updateAvailable' } as const
				let message: string | null = null
				if (explicit) {
					if (isLinux) {
						message = 'A new version of HopCoder is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
					}
				}
				return { message, action: 'download' } as const
			} else {
				let message: string | null = null
				if (explicit) {
					message = 'HopCoder is up-to-date!'
				}
				return { message } as const
			}
		} catch (e) {
			console.error('Error checking for updates:', e);
			if (explicit) {
				let message: string | null = null
				if (isLinux) {
					message = 'A new version of HopCoder is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
				}
				return { message, action: 'download' } as const
			}
			return { message: null } as const
		}
	}
}
