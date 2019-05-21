import React, {Component} from 'react';

import './todo-list.css';

import Selection from "@jetbrains/ring-ui/components/table/selection";
import Table from "@jetbrains/ring-ui/components/table/table";
import Pager from "@jetbrains/ring-ui/components/pager/pager";
import ContentEditable from "@jetbrains/ring-ui/components/contenteditable/contenteditable";
import Checkbox from "@jetbrains/ring-ui/components/checkbox/checkbox";
import {Col, Grid, Row} from "@jetbrains/ring-ui";
import Button from "@jetbrains/ring-ui/components/button/button";
import * as ReactDOM from "react-dom";
import Text from "@jetbrains/ring-ui/components/text/text";
import {CloseIcon} from "@jetbrains/ring-ui/components/icon/icons"
import Radio from "@jetbrains/ring-ui/components/radio/radio";
import Select from "@jetbrains/ring-ui/components/select/select";



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compId(id) {
  return it => it.id + '' === id + '';
}

function makeId(data, len = 7) {
  let id;
  do {
    id = Math.random().toString(36).substring(len);
  } while (data.findIndex(compId(id)) !== -1)
  return id;
}

const mock = require('./todo-list.json');

export default class TodoList extends Component {
  perPageSelect = [10, 20, 50, 100].map(it => ({key: it, label: it + ''}));
  state = {
    data: [],
    selection: new Selection(),
    caption: undefined,
    selectable: false,
    draggable: true,
    page: 1,
    pageSize: 10,
    sortKey: 'sort',
    sortOrder: true,
    loading: false,
    creating: false,
    filterByComplete: 0,
  }

  get totalFiltered() {
    return this.getFilteredData().length + (this.state.creating ? 1 : 0);
  }

  get maxPage() {
    return Math.ceil(this.totalFiltered / this.state.pageSize);
  }

  componentDidMount() {
    // на всякий случай восстанавливаем сортировку, если данные были как-то неправильно изменены.
    // в этом случае сортировка восстановится максимально приближенно (пропуски заполнятся правильно, а дубликаты случайно)
    this.reorder(0, 0);
  }

  componentDidUpdate(prevProps, prevState) {
    const {page, pageSize, sortKey, sortOrder, creating, filterByComplete} = this.state;
    if (
      creating !== prevState.creating ||
      filterByComplete !== prevState.filterByComplete ||
      page !== prevState.page ||
      pageSize !== prevState.pageSize ||
      sortKey !== prevState.sortKey ||
      sortOrder !== prevState.sortOrder
    ) {
      this.loadPage();
    }
  }

  async commitUpdate(updateInfo, {strict = false, loadPage = true} = {}) {
    this.setState({loading: true});
    const data = this.getData().slice();
    for (let id in updateInfo) {
      if (!updateInfo.hasOwnProperty(id)) continue;
      const i = data.findIndex(compId(id));
      const row = updateInfo[id];
      if (strict) {
        data[i] = row;
      } else {
        for (let key in row) {
          if (!row.hasOwnProperty(key)) continue;
          data[i][key] = row[key];
        }
      }
    }
    this.setData(data);

    if (loadPage) {
      this.loadPage();
    }
  }

  async commitDelete(ids) {
    this.setState({loading: true});

    const data = this.getData().slice();
    for (let id of ids) {
      const i = data.findIndex(compId(id));
      delete(data[i]);
    }
    this.setData(data.filter(val => val));
  }



  async commitCreate(task) {
    this.setState({loading: true});
    const data = this.getData().slice();
    const newDoc = {task, complete: false};
    newDoc.id = makeId(data);
    newDoc.sort = Math.max(0, ...data.map(o => o.sort)) + 1;
    data.push(newDoc);
    this.setData(data);
    this.setState({creating: false});
  }

  async cancelCreate() {
    this.setState({creating: false});
  }

  setData(data) {
    localStorage.setItem('data', JSON.stringify(data));
  }

  getData(id = null) {
    const stringData = localStorage.getItem('data') || '';
    if (!stringData) {
      const newData = [];
      let maxSort = -Infinity;
      for (let it of mock) {
        if (!it.id) it.id = makeId(newData);
        if (!it.sort) it.sort = null;
        maxSort = Math.max(maxSort, it.sort);
        newData.push(it);
      }
      for (let it of newData) {
        if (!it.sort) it.sort = maxSort + 1;
      }
      localStorage.setItem('data', JSON.stringify(newData));
      return this.getData();
    }
    const data = JSON.parse(stringData);

    if (id === null) return data;
    return data.find(compId(id));
  }

  _taskInputs = {};

  columns = [
    {
      id: 'sort',
      title: '#',
      rightAlign: true,
      headerClassName: 'sort-col',
      className: 'sort-col',
    },

    {
      id: 'complete',
      title: 'Выполнено',
      headerClassName: 'complete-col',
      className: 'complete-col',
      getValue: ({complete, id}) => <Checkbox checked={complete} disabled={id == null} onChange={(e) => this.updateCompletion(id, e)} />,
    },

    {
      id: 'task',
      title: 'Задача',
      getValue: ({task, id}) => (
        <ContentEditable
          ref={(c) => id ? this._taskInputs[id] = c : this._creatingTaskInput = c}
          style={{whiteSpace: 'pre'}}
          onKeyDown={this.auditTaskInput}
          onBlur={(e) => this.onTaskBlur(id, e)}
        >
          {task}
        </ContentEditable>
      ),
    },

    {
      id: 'actions',
      title: 'Действия',
      headerClassName: 'actions-col',
      className: 'actions-col',
      getValue: ({id}) => (
        <CloseIcon
          color={CloseIcon.Color.MAGENTA}
          title={'Удалить'}
          className={'ring-icon'}
          onClick={() => this.deleteTask(id)}
        />
      ),
    },
  ]

  async auditTaskInput(e) {
    e.persist();
    if (e.keyCode === 13 && !(e.ctrlKey || e.altKey || e.shiftKey)) {
      e.preventDefault();
      await sleep(0);
      e.target.blur();
      return false;
    }
    if (e.keyCode === 27) {
      e.preventDefault();
      e.target.denySave = true;
      await sleep(0);
      e.target.blur();
      return false;
    }
  }

  onTaskBlur = (id, e) => {
    if (e.target.denySave) {
      delete(e.target.denySave);
      if (!id) {
        this.cancelCreate();
        return;
      }
      e.target.innerHTML = this.getData(id).task;
    } else {
      this.updateTask(id, e.target.innerHTML);
    }
  }

  onSort = ({column: {id: sortKey}, order: sortOrder}) => {
    this.setState({sortKey, sortOrder});
  }

  onPageChange = page => {
    this.setState({page});
  }

  getFilteredData() {
    const rawData = this.getData().slice();
    let data;
    switch(this.state.filterByComplete) {
      case -1:
        data = rawData.filter(it => !it.complete);
        break;
      case 1:
        data = rawData.filter(it => it.complete);
        break;
      default:
        data = rawData;
    }
    return data;
  }

  loadPage = () => {
    const {page, pageSize, sortKey, sortOrder, creating} = this.state;

    let data = this.getFilteredData().slice();
    if (creating) {
      data.push({
        id: null,
        sort: Math.max(0, ...data.map(o => o.sort)) + 1,
        task: "",
        complete: false,
      });
    }

    let newPage = Math.max(Math.min(page, this.maxPage), 1);

    data.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * (sortOrder ? 1 : -1));
    data = data.slice((newPage - 1) * pageSize, (newPage - 1) * pageSize + pageSize);

    const selection = new Selection({data, isItemSelectable: this.isItemSelectable});

    this.setState({data, selection, page: newPage, loading: false});
  }

  deleteTask(id) {
    this.commitDelete([id]);
    this.reorder(0, 0);
  }

  updateCompletion(id, {target}) {
    const complete = target.checked;
    this.commitUpdate({[id]: {complete}});
  }

  /**
   * перемещает строки между собой с изменением сортировки промежуточных строк
   * также восстанавливает сортировку в случае повреждения данных
   * @param oldIndex старая позиция в текущем слайсе данных
   * @param newIndex новая позиция в текущем слайсе данных
   */
  reorder (oldIndex, newIndex) {
    this.setState({loading: true});
    const data = this.getData().slice();
    if (!data.length) {
      this.loadPage();
      return;
    }
    data.sort((a, b) => a.sort - b.sort);
    const updateObj = {};
    const pageData = this.state.data.slice();
    let oldSort, newSort;
    if (oldIndex >= this.state.data.length || newIndex >= this.state.data.length) {
      oldSort = newSort = 1;
    } else {
      oldSort = +pageData[oldIndex].sort;
      newSort = +pageData[newIndex].sort;
    }
    const forward = newSort > oldSort;
    let curSort = 1;
    let i = 1;
    for (let row of data) {
      if (i === newSort && !forward) {
        curSort++;
      }
      if (i === oldSort) {
        row.sort = newSort;
      } else {
        row.sort = curSort;
        curSort++;
      }
      if (i === newSort && forward) {
        curSort++;
      }
      i++;
      updateObj[row.id] = {sort: row.sort};
    }
    this.commitUpdate(updateObj);
  }

  updateTask(id, task) {
    if (id) {
      if (task) {
        this.commitUpdate({[id]: {task}});
      } else {
        this.deleteTask(id);
      }
    } else {
      if (task) {
        this.commitCreate(task);
      } else {
        this.cancelCreate();
      }
    }
  }

  updateSelection(newSelection) {
    newSelection = newSelection.resetFocus();
    this.setState({selection: newSelection});
  }

  startCreation = async () => {
    if (this._creatingTaskInput) {
      await sleep(0);
      ReactDOM.findDOMNode(this._creatingTaskInput).blur();
    }
    this.setState({creating: true});
    await sleep(0);
    this.setState({page: this.maxPage});
    await sleep(0);
    ReactDOM.findDOMNode(this._creatingTaskInput).focus();
  }

  render() {
    const {
      data, caption, selectable, draggable, loading, page,
      pageSize, selection, sortKey, sortOrder
    } = this.state;

    return (
      <div className={'todo-list'}>
        <Grid>
          <Row>
            <Col>
              {'Количество записей на странице: '}
              <Select
                key="select"
                type={Select.Type.INLINE}
                clear
                selected={this.perPageSelect.find(it => it.key === this.state.pageSize)}
                data={this.perPageSelect}
                onSelect={({key: pageSize}) => this.setState({pageSize})}
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <Radio onChange={(val) => this.setState({filterByComplete: +val}) }>
                <Radio.Item value="0" defaultChecked>Все</Radio.Item>
                <Radio.Item value="1">Выполненные</Radio.Item>
                <Radio.Item value="-1">Не выполненные</Radio.Item>
              </Radio>
            </Col>
          </Row>
        </Grid>
        {this.totalFiltered !== 0 && (
          <Table
            data={data}
            columns={this.columns}
            selection={selection}
            onSelect={(newSelection) => this.updateSelection(newSelection)}
            onReorder={({data: newData, oldIndex, newIndex}) => this.reorder(oldIndex, newIndex)}
            loading={loading}
            onSort={this.onSort}
            sortKey={sortKey}
            sortOrder={sortOrder}
            caption={caption}
            selectable={selectable}
            alwaysShowDragHandle={true}
            isItemSelectable={() => false}
            draggable={draggable}
            stickyHeader={true}
            autofocus
          />
        )}
        {this.totalFiltered === 0 && (
          <Text>Список пуст</Text>
        )}
        <Grid>
          <Row>
            <Col>
              <Pager
                total={this.totalFiltered}
                pageSize={pageSize}
                currentPage={page}
                disablePageSizeSelector

                translations={{
                  perPage: 'на страницу',
                  firstPage: 'Первая страница',
                  lastPage: 'Последняя страница',
                  nextPage: 'Следующая',
                  previousPage: 'Предыдущая'
                }}
                onPageChange={this.onPageChange}
              />
            </Col>
          </Row>

          <Row>
            <Col>
              <Button onClick={() => this.startCreation()}>Создать новую задачу</Button>
            </Col>
          </Row>
        </Grid>


      </div>
    );
  }
}

