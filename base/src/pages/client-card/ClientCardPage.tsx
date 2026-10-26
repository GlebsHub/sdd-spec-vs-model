import { ArrowLeftOutlined } from "@ant-design/icons";
import { getRouteApi, useCanGoBack, useRouter } from "@tanstack/react-router";
import { Button, Flex, Typography } from "antd";

const routeApi = getRouteApi("/clients/$clientId");

/** Заглушка карточки клиента. Сама карточка вне рамок раздела «Мои клиенты». */
export const ClientCardPage = () => {
  const { clientId } = routeApi.useParams();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = routeApi.useNavigate();

  const goBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: "/clients" });
  };

  return (
    <Flex vertical gap="middle" align="flex-start">
      <Button icon={<ArrowLeftOutlined aria-hidden />} onClick={goBack}>
        Назад
      </Button>
      <Typography.Title level={2}>Карточка клиента</Typography.Title>
      <Typography.Text type="secondary">ID: {clientId}</Typography.Text>
    </Flex>
  );
};
