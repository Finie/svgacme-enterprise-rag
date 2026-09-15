import { HealthModule } from '../health/health.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { SearchModule } from '../search/search.module.js';
import { QuestionsModule } from '../questions/questions.module.js';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from '@/app/app.controller.js';
import { AppService } from '@/app/app.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const appKey = process.env.OBSERVE_APP_KEY?.trim();
const appSecret = process.env.OBSERVE_APP_SECRET?.trim();
export const observeEnabled = Boolean(appKey && appSecret);

@Module({
  imports: [
    HealthModule,
    PoliciesModule,
    SearchModule,
    QuestionsModule,
    ...(appKey && appSecret
      ? [
          ObserveModule.forRoot({
            appKey,
            appSecret,
            serviceId: 'nest-typescript-starter',
          }),
        ]
      : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
