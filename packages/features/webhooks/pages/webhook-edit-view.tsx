import { useRouter, useSearchParams } from "next/navigation";
import z from "zod";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Meta, showToast, SkeletonContainer } from "@calcom/ui";

import { getLayout } from "../../settings/layouts/SettingsLayout";
import type { WebhookFormSubmitData } from "../components/WebhookForm";
import WebhookForm from "../components/WebhookForm";

const querySchema = z.object({ id: z.string() });
const EditWebhook = () => {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const utils = trpc.useContext();
  const router = useRouter();
  function Component({ webhookId }: { webhookId: string }) {
    const { data: installedApps, isLoading } = trpc.viewer.integrations.useQuery(
      { variant: "other", onlyInstalled: true },
      {
        suspense: true,
        enabled: true,
      }
    );
    const { data: webhook } = trpc.viewer.webhook.get.useQuery(
      { webhookId },
      {
        suspense: true,
        enabled: true,
      }
    );
    const { data: webhooks } = trpc.viewer.webhook.list.useQuery(undefined, {
      suspense: true,
      enabled: true,
    });
    const editWebhookMutation = trpc.viewer.webhook.edit.useMutation({
      async onSuccess() {
        await utils.viewer.webhook.list.invalidate();
        showToast(t("webhook_updated_successfully"), "success");
        router.back();
      },
      onError(error) {
        showToast(`${error.message}`, "error");
      },
    });
    const subscriberUrlReserved = (subscriberUrl: string, id: string): boolean => {
      return !!webhooks?.find((webhook) => webhook.subscriberUrl === subscriberUrl && webhook.id !== id);
    };
    if (isLoading || !webhook) return <SkeletonContainer />;
    return (
      <>
        <Meta
          title={t("edit_webhook")}
          description={t("add_webhook_description", { appName: APP_NAME })}
          backButton
        />
        <WebhookForm
          webhook={webhook}
          onSubmit={(values: WebhookFormSubmitData) => {
            if (subscriberUrlReserved(values.subscriberUrl, webhook.id)) {
              showToast(t("webhook_subscriber_url_reserved"), "error");
              return;
            }
            if (values.changeSecret) {
              values.secret = values.newSecret.length ? values.newSecret : null;
            }
            if (!values.payloadTemplate) {
              values.payloadTemplate = null;
            }
            editWebhookMutation.mutate({
              id: webhook.id,
              subscriberUrl: values.subscriberUrl,
              eventTriggers: values.eventTriggers,
              active: values.active,
              payloadTemplate: values.payloadTemplate,
              secret: values.secret,
            });
          }}
          apps={installedApps?.items.map((app) => app.slug)}
        />
      </>
    );
  }
  if (!searchParams) return null;
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams ?? new URLSearchParams()));
  if (!parsed.success) {
    throw new Error("Invalid query");
  }
  // tRPC useQuery needs webhookId to be available and it becomes available only after router.isReady is true
  // It causes this requirement of a new component.
  // I think we should do SSR for this page
  return <Component webhookId={parsed.data.id} />;
};
EditWebhook.getLayout = getLayout;
export default EditWebhook;
