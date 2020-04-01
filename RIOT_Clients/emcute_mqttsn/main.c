/*
 * Copyright (C) 2015 Freie Universität Berlin
 *
 * This file is subject to the terms and conditions of the GNU Lesser
 * General Public License v2.1. See the file LICENSE in the top level
 * directory for more details.
 */

/**
 * @ingroup     examples
 * @{
 *
 * @file
 * @brief       Example application for demonstrating RIOT's MQTT-SN library
 *              emCute
 *
 * @author      Hauke Petersen <hauke.petersen@fu-berlin.de>
 *
 * @}
 */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "thread.h"
#include "xtimer.h"
#include <time.h> // time()
#include "shell.h"
#include "msg.h"
#include "net/emcute.h"
#include "net/ipv6/addr.h"

#ifndef EMCUTE_ID
#define EMCUTE_ID ("gertrud")
#endif
#define EMCUTE_PORT (1883U)
#define EMCUTE_PRIO (THREAD_PRIORITY_MAIN - 1)

#define NUMOFSUBS (16U)
#define TOPIC_MAXLEN (64U)

static char stack[THREAD_STACKSIZE_DEFAULT];
static msg_t queue[8];

static emcute_sub_t subscriptions[NUMOFSUBS];
static char topics[NUMOFSUBS][TOPIC_MAXLEN];

static void *emcute_thread(void *arg)
{
    (void)arg;
    emcute_run(EMCUTE_PORT, EMCUTE_ID);
    return NULL; /* should never be reached */
}

static void on_pub(const emcute_topic_t *topic, void *data, size_t len)
{
    char *in = (char *)data;

    printf("### got publication for topic '%s' [%i] ###\n",
           topic->name, (int)topic->id);
    for (size_t i = 0; i < len; i++)
    {
        printf("%c", in[i]);
    }
    puts("");
}

static unsigned get_qos(const char *str)
{
    int qos = atoi(str);
    switch (qos)
    {
    case 1:
        return EMCUTE_QOS_1;
    case 2:
        return EMCUTE_QOS_2;
    default:
        return EMCUTE_QOS_0;
    }
}

static int cmd_con(int argc, char **argv)
{
    sock_udp_ep_t gw = {.family = AF_INET6, .port = EMCUTE_PORT};
    char *topic = NULL;
    char *message = NULL;
    size_t len = 0;

    if (argc < 2)
    {
        printf("usage: %s <ipv6 addr> [port] [<will topic> <will message>]\n",
               argv[0]);
        return 1;
    }

    /* parse address */
    if (ipv6_addr_from_str((ipv6_addr_t *)&gw.addr.ipv6, argv[1]) == NULL)
    {
        printf("error parsing IPv6 address\n");
        return 1;
    }

    if (argc >= 3)
    {
        gw.port = atoi(argv[2]);
    }
    if (argc >= 5)
    {
        topic = argv[3];
        message = argv[4];
        len = strlen(message);
    }

    if (emcute_con(&gw, true, topic, message, len, 0) != EMCUTE_OK)
    {
        printf("error: unable to connect to [%s]:%i\n", argv[1], (int)gw.port);
        return 1;
    }
    printf("Successfully connected to gateway at [%s]:%i\n",
           argv[1], (int)gw.port);

    return 0;
}

static int cmd_discon(int argc, char **argv)
{
    (void)argc;
    (void)argv;

    int res = emcute_discon();
    if (res == EMCUTE_NOGW)
    {
        puts("error: not connected to any broker");
        return 1;
    }
    else if (res != EMCUTE_OK)
    {
        puts("error: unable to disconnect");
        return 1;
    }
    puts("Disconnect successful");
    return 0;
}

static int cmd_pub(int argc, char **argv)
{
    emcute_topic_t t;
    unsigned flags = EMCUTE_QOS_0;

    if (argc < 3)
    {
        printf("usage: %s <topic name> <data> [QoS level]\n", argv[0]);
        return 1;
    }

    /* parse QoS level */
    if (argc >= 4)
    {
        flags |= get_qos(argv[3]);
    }

    printf("pub with topic: %s and name %s and flags 0x%02x\n", argv[1], argv[2], (int)flags);

    /* step 1: get topic id */
    t.name = argv[1];
    if (emcute_reg(&t) != EMCUTE_OK)
    {
        puts("error: unable to obtain topic ID");
        return 1;
    }

    /* step 2: publish data */
    if (emcute_pub(&t, argv[2], strlen(argv[2]), flags) != EMCUTE_OK)
    {
        printf("error: unable to publish data to topic '%s [%i]'\n",
               t.name, (int)t.id);
        return 1;
    }

    printf("Published %i bytes to topic '%s [%i]'\n",
           (int)strlen(argv[2]), t.name, t.id);

    return 0;
}

static int cmd_sub(int argc, char **argv)
{
    unsigned flags = EMCUTE_QOS_0;

    if (argc < 2)
    {
        printf("usage: %s <topic name> [QoS level]\n", argv[0]);
        return 1;
    }

    if (strlen(argv[1]) > TOPIC_MAXLEN)
    {
        puts("error: topic name exceeds maximum possible size");
        return 1;
    }
    if (argc >= 3)
    {
        flags |= get_qos(argv[2]);
    }

    /* find empty subscription slot */
    unsigned i = 0;
    for (; (i < NUMOFSUBS) && (subscriptions[i].topic.id != 0); i++)
    {
    }
    if (i == NUMOFSUBS)
    {
        puts("error: no memory to store new subscriptions");
        return 1;
    }

    subscriptions[i].cb = on_pub;
    strcpy(topics[i], argv[1]);
    subscriptions[i].topic.name = topics[i];
    if (emcute_sub(&subscriptions[i], flags) != EMCUTE_OK)
    {
        printf("error: unable to subscribe to %s\n", argv[1]);
        return 1;
    }

    printf("Now subscribed to %s\n", argv[1]);
    return 0;
}

static int cmd_unsub(int argc, char **argv)
{
    if (argc < 2)
    {
        printf("usage %s <topic name>\n", argv[0]);
        return 1;
    }

    /* find subscriptions entry */
    for (unsigned i = 0; i < NUMOFSUBS; i++)
    {
        if (subscriptions[i].topic.name &&
            (strcmp(subscriptions[i].topic.name, argv[1]) == 0))
        {
            if (emcute_unsub(&subscriptions[i]) == EMCUTE_OK)
            {
                memset(&subscriptions[i], 0, sizeof(emcute_sub_t));
                printf("Unsubscribed from '%s'\n", argv[1]);
            }
            else
            {
                printf("Unsubscription form '%s' failed\n", argv[1]);
            }
            return 0;
        }
    }

    printf("error: no subscription for topic '%s' found\n", argv[1]);
    return 1;
}

static int cmd_will(int argc, char **argv)
{
    if (argc < 3)
    {
        printf("usage %s <will topic name> <will message content>\n", argv[0]);
        return 1;
    }

    if (emcute_willupd_topic(argv[1], 0) != EMCUTE_OK)
    {
        puts("error: unable to update the last will topic");
        return 1;
    }
    if (emcute_willupd_msg(argv[2], strlen(argv[2])) != EMCUTE_OK)
    {
        puts("error: unable to update the last will message");
        return 1;
    }

    puts("Successfully updated last will topic and message");
    return 0;
}
static char *generate_value(char *device)
{
    char data[12];
    char *ret = malloc(sizeof(char) * 40);

    if (!strcmp(device, "thermometer"))
    {
        int temp = (rand() % 101) - 50;
        sprintf(data, "%d °C", temp);

        strcpy(ret, device);
        strcpy(ret, ":");
        strcpy(ret, data);
        return ret;
    }
    else if (!strcmp(device, "humidity"))
    {
        int humd = (rand() % 101);
        sprintf(data, "%d %%", humd);

        strcpy(ret, device);
        strcpy(ret, ":");
        strcpy(ret, data);
        return ret;
    }
    else if (!strcmp(device, "wind-direction"))
    {
        int wddr = (rand() % 360);
        sprintf(data, "%d °", wddr);

        strcpy(ret, device);
        strcpy(ret, ":");
        strcpy(ret, data);
        return ret;
    }
    else if (!strcmp(device, "wind-intensity"))
    {
        int wdin = (rand() % 101);
        sprintf(data, "%d m/s", wdin);

        strcpy(ret, device);
        strcpy(ret, ":");
        strcpy(ret, data);
        return ret;
    }
    else
    {
        int rahg = (rand() % 51);
        sprintf(data, "%d mm/h", rahg);

        strcpy(ret, device);
        strcpy(ret, ":");
        strcpy(ret, data);
        return ret;
    }
}

//enum DEVICES(THERMOMETER, HUMIDITY, WIND_DIRECTION, WIND_INTENSITY, RAIN_HEIGHT);

static int cmd_polling_pub(int argc, char **argv)
{
    emcute_topic_t t;
    time_t tm;
    srand((unsigned)time(&tm));
    unsigned flags = EMCUTE_QOS_0;

    if (argc < 3)
    {
        printf("usage: l%s <topic name> <device-OPTIONAL> <polling-OPTIONAL(in seconds)>\n", argv[0]);
        return 1;
    }

    printf("pub with topic: %s and name %s for %s *1.5 s and flags 0x%02x\n", argv[1], argv[2], argv[3], (int)flags);

    /* step 1: get topic and device id */
    t.name = argv[1];

    if (emcute_reg(&t) != EMCUTE_OK)
    {
        puts("error: unable to obtain topic ID");
        return 1;
    }
    char *device;
    int i = argv[3] != NULL ? atoi(argv[3]) : 60;
    int random = 0;
    while (i != 0)
    {
        printf("\n\n========================================\n");
        if (argv[2] != NULL && strcmp(argv[2], "random"))
        {
            device = argv[2];
        }
        else
        {
            random = rand() % 5;
            printf("Device id extracted: %d\n", random);
            switch (random)
            {
            case 0:
                device = "thermometer";
                break;
            case 1:
                device = "humidity";
                break;
            case 2:
                device = "wind-direction";
                break;
            case 3:
                device = "wind-intensity";
                break;
            case 4:
                device = "rain-height";
                break;
            default:
                return -1;
                break;
            }
        }

        char *data = generate_value(device);
        printf("Device %s push data: %s\n", device, data);
        printf("========================================\n");

        xtimer_sleep(1.5);

        if (emcute_pub(&t, data, strlen(data), flags) != EMCUTE_OK)
        {
            printf("error: unable to publish data to topic '%s [%i]'\n", t.name, (int)t.id);
            return 1;
        }

        i--;
    }
    /* step 2: publish data */

    printf("Published %i bytes to topic '%s [%i]'\n",
           (int)strlen(argv[2]), t.name, t.id);

    return 0;
}

static const shell_command_t shell_commands[] = {
    {"con", "connect to MQTT broker", cmd_con},
    {"discon", "disconnect from the current broker", cmd_discon},
    {"pub", "publish something", cmd_pub},
    {"polling_pub", "publish something in polling every 5s", cmd_polling_pub},
    {"sub", "subscribe topic", cmd_sub},
    {"unsub", "unsubscribe from topic", cmd_unsub},
    {"will", "register a last will", cmd_will},
};

int main(void)
{
    puts("MQTT-SN example application\n");
    puts("Type 'help' to get started. Have a look at the README.md for more"
         "information.");

    /* the main thread needs a msg queue to be able to run `ping6`*/
    msg_init_queue(queue, ARRAY_SIZE(queue));

    /* initialize our subscription buffers */
    memset(subscriptions, 0, (NUMOFSUBS * sizeof(emcute_sub_t)));

    /* start the emcute thread */
    thread_create(stack, sizeof(stack), EMCUTE_PRIO, 0,
                  emcute_thread, NULL, "emcute");

    /* start shell */
    char line_buf[SHELL_DEFAULT_BUFSIZE];
    shell_run(shell_commands, line_buf, SHELL_DEFAULT_BUFSIZE);

    /* should be never reached */
    return 0;
}
