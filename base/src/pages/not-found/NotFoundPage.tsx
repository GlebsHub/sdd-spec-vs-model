import { Link } from "@tanstack/react-router";
import { Button, Result } from "antd";

export const NotFoundPage = () => (
  <Result
    status="404"
    title="Страница не найдена"
    extra={
      <Link to="/clients">
        <Button type="primary">К списку клиентов</Button>
      </Link>
    }
  />
);
