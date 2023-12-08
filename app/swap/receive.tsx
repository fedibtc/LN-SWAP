import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Rate } from ".";
import { Shitcoin } from "@/lib/constants";
import { useToast } from "@/components/ui/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const FormSchema = z.object({
  amount: z.number().min(0),
});

export default function Receive({
  rate,
  setOrder,
  shitcoin,
}: {
  rate?: Rate;
  setOrder: Dispatch<SetStateAction<{ token: string; id: string } | null>>;
  shitcoin: Shitcoin;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [invoiceUri, setInvoiceUri] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      amount: rate?.from.min || 0,
    },
  });

  const { mutate, status, data } = useMutation({
    mutationFn: async (data: z.infer<typeof FormSchema>) => {
      if (typeof window.webln !== "undefined") {
        await window.webln.enable();

        const rates = await fetch(`/api/rate?from=${shitcoin}&to=BTC`).then(
          (r) => r.json(),
        );

        if (rates) {
          try {
            const sats = +(data.amount * rates.data.from.rate).toFixed(7);

            const { paymentRequest } = await window.webln.makeInvoice({
              amount: sats * 100000000,
            });

            const res = await fetch("/api/receive", {
              method: "POST",
              body: JSON.stringify({
                from: shitcoin,
                amount: sats,
                address: paymentRequest,
              }),
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }).then((r) => r.json());

            if (res.error) {
              toast({
                content: res.error,
              });
            } else {
              setOpen(true);
              setOrder({
                id: res.data.id,
                token: res.data.token,
              });
              return res;
            }
          } catch (e) {
            toast({
              content: (e as any).message,
            });
          }
        }
      }
    },
  });

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        content: "Copied!",
        duration: 1500,
      });
    });
  };

  useEffect(() => {
    if (rate?.from.min && typeof rate.from.min === "number")
      form.setValue("amount", rate?.from.min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.from.min]);

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => mutate(data))}
          className="flex flex-col gap-4 w-full grow items-stretch"
        >
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ({shitcoin})</FormLabel>
                <Input
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  placeholder="69420"
                  type="number"
                  min={rate?.from.min}
                  max={rate?.from.max}
                  step="any"
                />
                <span className="text-xs text-muted-foreground">
                  + Swap Fee: {(field.value / 100).toFixed(3)} {shitcoin}
                </span>
              </FormItem>
            )}
          />

          <Button type="submit" className="grow" loading={status === "pending"}>
            {" "}
            Submit
          </Button>
        </form>
      </Form>

      <Dialog open={open} onOpenChange={setOpen} title="Send Payment">
        {data ? (
          <div className="flex flex-col gap-md">
            {invoiceUri ? (
              <div className="flex gap-sm items-start p-md rounded-lg border border-lightGrey">
                <Icon
                  icon="IconAlertCircle"
                  className="w-lg h-lg shrink-0 mt-sm"
                />
                <div className="flex flex-col gap-sm">
                  <Text variant="h2" weight="medium">
                    Heads Up!
                  </Text>
                  <Text>
                    Some apps don&apos;t support invoice URIs and some work only
                    on certain networks.
                  </Text>
                </div>
              </div>
            ) : (
              <div className="flex gap-sm items-start p-md rounded-lg border border-lightGrey">
                <Icon
                  icon="IconAlertCircle"
                  className="w-lg h-lg shrink-0 mt-sm"
                />
                <div className="flex flex-col gap-sm">
                  <Text variant="h2" weight="medium">
                    Important Notice
                  </Text>
                  <Text>
                    You must send Exactly{" "}
                    <span
                      className="text-foreground cursor-pointer border-b border-foreground"
                      onClick={() => copyText(data.data.amount)}
                    >
                      <Icon
                        icon="IconCopy"
                        className="w-3 h-3 inline shrink-0"
                      />{" "}
                      {data.data.amount} {shitcoin}
                    </span>{" "}
                    to the{" "}
                    <span
                      className="text-foreground cursor-pointer border-b border-foreground"
                      onClick={() => copyText(data.data.recipientAddress)}
                    >
                      <Icon icon="IconCopy" className="w-3 h-3 inline" />{" "}
                      Recipient Address
                    </span>{" "}
                    or <strong className="text-foreground">ALL</strong> funds
                    will be lost
                  </Text>
                </div>
              </div>
            )}

            <div className="flex justify-center p-4 bg-secondary rounded-lg w-full">
              <QRCode
                size={256}
                value={
                  invoiceUri ? data.data.invoice : data.data.recipientAddress
                }
                style={{
                  height: "auto",
                  maxWidth: "100%",
                  width: "100%",
                  maxHeight: 360,
                }}
              />
            </div>

            <div className="flex gap-2 items-center w-full min-w-0">
              <Button
                className="!p-sm rounded-sm w-xxl shrink-0 rounded-lg !border !border-lightGrey shrink-0"
                variant="outline"
                onClick={() =>
                  copyText(
                    invoiceUri ? data.data.invoice : data.data.recipientAddress,
                  )
                }
              >
                <Icon icon="IconCopy" className="w-4 h-4" />
              </Button>

              <span className="line-clamp-2 text-xs text-muted-foreground">
                {invoiceUri ? data.data.invoice : data.data.recipientAddress}
              </span>
            </div>

            <div className="flex gap-2 items-center">
              <Checkbox checked={invoiceUri} onChange={setInvoiceUri} />{" "}
              <span className="text-sm">Shitcoin URI</span>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
