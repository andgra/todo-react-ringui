import React, {Component} from 'react';
import Header, {
  Logo,
} from '@jetbrains/ring-ui/components/header/header';
import Footer from '@jetbrains/ring-ui/components/footer/footer';
import tsLogo from '@jetbrains/logos/teamcity/teamcity.svg';

import './app.css';

import TodoList from './todo-list';

export default class AppRoot extends Component {
  render() {
    return (
      <div>
        <Header>
          <a href="/">
            <Logo
              glyph={tsLogo}
              size={Logo.Size.Size48}
            />
          </a>
        </Header>

        <div className="app-content">
          <TodoList/>
        </div>
        <Footer/>
      </div>
    );
  }
}
