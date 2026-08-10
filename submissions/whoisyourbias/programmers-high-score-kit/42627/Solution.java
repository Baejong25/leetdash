// 1 ≤ jobs의 길이 ≤ 500
// jobs[i]는 i번 작업에 대한 정보이고 [s, l] 형태입니다.
// s는 작업이 요청되는 시점이며 0 ≤ s ≤ 1,000입니다.
// l은 작업의 소요시간이며 1 ≤ l ≤ 1,000입니다.

import java.util.*;
import java.util.Map.Entry;

class Solution {

	static class Status {
		int remainJobTime;
		final int requestedTime;
		final int jobId;

		Status(int remainJobTime, int requestedTime, int jobId) {
			this.remainJobTime = remainJobTime;
			this.requestedTime = requestedTime;
			this.jobId = jobId;
		}

		public void tick() {
			this.remainJobTime--;
        }
		
		@Override
		public String toString() {
			return String.format("[ID: %d  | remainTime: %d | requestedTime: %d]\n", jobId, remainJobTime, requestedTime);
		}
	}

    public int solution(int[][] jobs) {
        int answer = 0;

		Comparator<Status> DiskComp = new Comparator<Status>() {
				@Override
				public int compare(Status o1, Status o2) {
					// 작업의 소요시간이 짧은 것, 
					if (o1.remainJobTime < o2.remainJobTime)
						return -1;
					else if (o1.remainJobTime > o2.remainJobTime)
						return 1;


					// 작업의 요청 시각이 빠른 것, 
					if (o1.requestedTime < o2.requestedTime)
						return -1;
					else if (o1.requestedTime > o2.requestedTime)
						return 1;


					// 작업의 번호가 작은 것 순으로 우선순위가 높습니다.
					if (o1.jobId < o2.jobId)
						return -1;
					else if (o1.jobId > o2.jobId)
						return 1;
					

					return 0;
				};
			};

		LinkedList<Status> queue = new LinkedList<>();
		TreeMap<Integer, LinkedList<Status>> heap = new TreeMap<>();

		// init treemap
		for (int i  = 0;  i < jobs.length; i++) {
			int s = jobs[i][0];
			int l = jobs[i][1];

			LinkedList<Status> lst = heap.getOrDefault(s, new LinkedList<>());

			lst.add(new Status(l,s,i));
			heap.put(s, lst);
		}



		int t  = 0;
        Status current = null;

        while (!(current == null && queue.isEmpty() && heap.isEmpty())) {
            // 현재시간에 도착해야하는 애들 대기큐에 밀어넣기.
            LinkedList<Status> lst = heap.getOrDefault(t, new LinkedList<Status>());
            for (Status s : lst) {
                queue.add(s);
            }
            heap.remove(t);
		
            queue.sort(DiskComp);

            
            // current가 있으면 틱 이후 작업종료확인하기.
            if (current != null) {
                current.tick();
                if (current.remainJobTime == 0) {
                    answer += t - current.requestedTime;
                    current = null;
                }
            }
            // current가 null 이면 대기큐에서 pollfirst해서 current에 넣고
            if (current == null) {
                if (!queue.isEmpty()) {
                    current = queue.pollFirst();
                }
            }
            t++;
        }

		

		return answer / jobs.length;
    }
}
