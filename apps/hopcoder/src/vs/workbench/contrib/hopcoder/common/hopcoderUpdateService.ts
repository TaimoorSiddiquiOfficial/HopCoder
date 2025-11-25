/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { VoidCheckUpdateRespose } from './hopcoderUpdateServiceTypes.js';



export interface IhopcoderUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<VoidCheckUpdateRespose>;
}


export const IhopcoderUpdateService = createDecorator<IhopcoderUpdateService>('hopcoderUpdateService');


// implemented by calling channel
export class hopcoderUpdateService implements IhopcoderUpdateService {

	readonly _serviceBrand: undefined;
	private readonly hopcoderUpdateService: IhopcoderUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.hopcoderUpdateService = ProxyChannel.toService<IhopcoderUpdateService>(mainProcessService.getChannel('void-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IhopcoderUpdateService['check'] = async (explicit) => {
		const res = await this.hopcoderUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IhopcoderUpdateService, hopcoderUpdateService, InstantiationType.Eager);


